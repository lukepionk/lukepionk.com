# Luke Pionk

Source for my personal website at **lukepionk.com**. Five sections: Header,
Now, Work, Resources, and Contact.

The site is plain HTML and CSS. It needs no application server, database,
JavaScript, cookies, remote fonts, or build step. The small scope keeps the
site easy to read, operate, and change.

## Run locally

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. Edit `site/index.html` for content and
`site/styles.css` for presentation.

## Verify

```sh
npx playwright install chromium
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

The browser checks cover desktop and mobile layouts, narrow screens, keyboard
navigation, automated accessibility, internal links, and the missing-page
document. Deployment tests verify that only committed public files can enter
the upload, excluding private notes, untracked files, and symlinks.

## Hosting

Porkbun owns the registration and authoritative DNS. CloudFront serves HTTPS
from a private, encrypted S3 bucket using origin access control. The bucket
blocks public access, retains object versions for recovery, and expires
noncurrent versions after 30 days.

`infra/site.yaml` defines the bucket, access policy, CloudFront distribution,
and the WAF web ACL required by CloudFront's Free flat-rate plan. The stack
starts with delivery disabled. Activate the Free plan, upload the site, then
enable delivery. An ACM certificate in `us-east-1` attaches the custom domains.
The CloudFront address can serve the site while DNS verification is pending.

Use the **Free flat-rate plan**, not just a pay-as-you-go distribution with a
free allowance. The current Free plan is $0/month with 1 million requests,
100 GB transfer, and credits for 5 GB of S3 Standard storage. S3 requests and
domain renewal are separate. Near-zero hosting cost is the expectation at
personal-site traffic, not a guarantee of a zero AWS account bill.

A web ACL is billed at standard rates until the Free plan is active.
Do not leave a partially configured stack without checking its plan status.
The publish command requires an active `FREE` subscription and never upgrades
to a paid tier.

Sources, checked September 2026:

- [CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/)
- [Plan coverage and limits](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html)
- [Programmatic plan management](https://docs.aws.amazon.com/PricingPlanManager/latest/UserGuide/getting-started-pricingplanmanager-api.html)
- [S3 pricing](https://aws.amazon.com/s3/pricing/)
- [Porkbun ALIAS and CNAME instructions](https://kb.porkbun.com/article/85-how-to-connect-your-root-domain-when-your-web-host-wont-provide-an-ip-address)

## Release

AWS commands must use the personal `lpionk_cli` profile. Use a current AWS CLI
that includes `pricing-plan-manager`; the initial setup used CLI 2.36.45.
Production writes need authorization for this website.

After tests and review, commit the intended changes. If the repository has a
remote, push the commit to its upstream before publishing.

```sh
python3 scripts/publish.py --check
python3 scripts/publish.py
```

The script exports the six allowed public files directly from Git, requires a
clean checkout, verifies the remote revision when configured, verifies the
Free plan, uploads assets before the homepage, and checks each uploaded SHA-256.
It requests a CloudFront invalidation and writes an ignored `.deploy/release.json`
record. Confirm invalidation completion and verify the live page afterward.

The infrastructure change uses a committed template:

```sh
mkdir -p .deploy
git show HEAD:infra/site.yaml > .deploy/site.yaml
aws cloudformation deploy --profile lpionk_cli --region us-east-1 \
  --stack-name lukepionk-website --template-file .deploy/site.yaml \
  --parameter-overrides SiteEnabled=false \
  --no-fail-on-empty-changeset
```

For the first activation, obtain `DistributionArn` and `WebACLArn` from the
stack outputs, then subscribe both to the `CloudFront` family, `FREE` tier,
with `IMMEDIATE` approval mode. Confirm `ACTIVE` before publishing. Enable
the distribution with `SiteEnabled=true` only after the upload succeeds.
Keep any existing `CertificateArn` parameter when updating the stack.

DNS requires ACM's exact validation CNAME records, an apex ALIAS to the
distribution hostname, and a `www` CNAME to that hostname. Preserve mail and
unrelated DNS records. Keep certificate validation records for automatic renewal.

Current design decisions are in [the v2 design note](docs/design/specs/v2.md).
The [v1 design note](docs/design/specs/v1.md) remains as project history.
