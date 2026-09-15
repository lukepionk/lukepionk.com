#!/usr/bin/env python3
"""Publish only the six public files from a clean, committed revision."""

import argparse
import base64
import hashlib
import json
import mimetypes
from pathlib import Path
import subprocess
import tempfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = {"index.html", "404.html", "styles.css", "favicon.svg", "robots.txt", "sitemap.xml"}


def git(*args, root=ROOT):
    return subprocess.check_output(["git", "-C", str(root), *args])


def aws(*args):
    result = subprocess.check_output([
        "aws", *args, "--profile", "lpionk_cli", "--region", "us-east-1",
        "--output", "json", "--no-cli-pager",
    ])
    return json.loads(result)


def export_site(root, commit, destination):
    entries = git("ls-tree", "-rz", commit, "--", "site/", root=root).split(b"\0")
    files = {}
    for entry in filter(None, entries):
        metadata, raw_path = entry.split(b"\t", 1)
        mode, kind, _ = metadata.split()
        path = raw_path.decode()
        name = path.removeprefix("site/")
        if mode != b"100644" or kind != b"blob" or name not in PUBLIC_FILES:
            raise ValueError(f"Unexpected public file: {path}")
        content = git("show", f"{commit}:{path}", root=root)
        (destination / name).write_bytes(content)
        files[name] = {
            "bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
            "checksum": base64.b64encode(hashlib.sha256(content).digest()).decode(),
        }
    if set(files) != PUBLIC_FILES:
        raise ValueError("The public file set is incomplete.")
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check the committed artifact without contacting AWS.")
    args = parser.parse_args()
    if git("status", "--porcelain").strip():
        raise SystemExit("Commit or remove pending changes before publishing.")
    commit = git("rev-parse", "HEAD").decode().strip()
    with tempfile.TemporaryDirectory(prefix="lukepionk-site-") as directory:
        artifact = Path(directory)
        files = export_site(ROOT, commit, artifact)
        print(f"Commit: {commit}\nPublic files: {len(files)}\nBytes: {sum(f['bytes'] for f in files.values())}", flush=True)
        if args.check:
            return

        # A configured remote must already contain the exact revision.
        if git("remote").strip():
            upstream = git("rev-parse", "--abbrev-ref", "@{upstream}").decode().strip()
            remote, branch = upstream.split("/", 1)
            remote_head = git("ls-remote", remote, f"refs/heads/{branch}").decode().split()
            if not remote_head or remote_head[0] != commit:
                raise SystemExit("Push this exact commit to its upstream before publishing.")

        stack = aws("cloudformation", "describe-stacks", "--stack-name", "lukepionk-website")["Stacks"][0]
        outputs = {entry["OutputKey"]: entry["OutputValue"] for entry in stack["Outputs"]}
        account = aws("sts", "get-caller-identity")["Account"]
        if outputs["BucketName"] != f"lukepionk-com-{account}":
            raise SystemExit("The stack bucket does not match the selected AWS account.")
        plans = aws("pricing-plan-manager", "list-subscriptions")["subscriptionSummaries"]
        if not any(
            plan["planTier"] == "FREE" and plan["status"] == "ACTIVE"
            and outputs["DistributionArn"] in plan["resourceArns"] for plan in plans
        ):
            raise SystemExit("An active CloudFront FREE plan is required before publishing.")

        # Assets first; the homepage switches last. Never upload the repository root.
        ordered = sorted(files, key=lambda name: name == "index.html")
        for name in ordered:
            content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
            aws(
                "s3api", "put-object", "--bucket", outputs["BucketName"], "--key", name,
                "--body", str(artifact / name), "--content-type", content_type,
                "--cache-control", "public,max-age=300",
                "--checksum-algorithm", "SHA256",
                "--metadata", f"commit={commit}",
            )
            uploaded = aws(
                "s3api", "head-object", "--bucket", outputs["BucketName"],
                "--key", name, "--checksum-mode", "ENABLED",
            )
            if uploaded.get("ChecksumSHA256") != files[name]["checksum"]:
                raise SystemExit(f"Uploaded bytes do not match the committed file: {name}")

        invalidation = aws(
            "cloudfront", "create-invalidation",
            "--distribution-id", outputs["DistributionId"], "--paths", "/*",
        )
        record = {
            "commit": commit, "account": account, "profile": "lpionk_cli",
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "outputs": outputs, "files": files,
            "invalidation": invalidation["Invalidation"]["Id"],
        }
        (ROOT / ".deploy").mkdir(exist_ok=True)
        (ROOT / ".deploy" / "release.json").write_text(json.dumps(record, indent=2) + "\n")
        print(f"Verified {len(files)} uploaded files. Distribution: {outputs['DistributionDomain']}")
        print("Check the CloudFront deployment and invalidation status before verifying the live site.")


if __name__ == "__main__":
    main()
