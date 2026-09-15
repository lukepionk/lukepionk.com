import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("publish", Path(__file__).parents[1] / "scripts/publish.py")
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.output = self.root / "artifact"
        self.output.mkdir()
        self.run_git("init", "-q")
        self.run_git("config", "user.name", "Test")
        self.run_git("config", "user.email", "test@example.com")
        (self.root / "site").mkdir()
        for name in publish.PUBLIC_FILES:
            (self.root / "site" / name).write_text("committed content")
        (self.root / "private-notes.txt").write_text("must not be published")

    def run_git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.root), *args], stderr=subprocess.DEVNULL)

    def commit(self):
        self.run_git("add", "site")
        self.run_git("commit", "-qm", "Fixture")

    def test_export_uses_committed_public_bytes_only(self):
        self.commit()
        (self.root / "site/index.html").write_text("uncommitted content")
        (self.root / "site/secret.txt").write_text("untracked content")
        files = publish.export_site(self.root, "HEAD", self.output)
        self.assertEqual(set(files), publish.PUBLIC_FILES)
        self.assertEqual(set(p.name for p in self.output.iterdir()), publish.PUBLIC_FILES)
        self.assertEqual((self.output / "index.html").read_text(), "committed content")

    def test_symlinks_cannot_publish_private_files(self):
        (self.root / "site/index.html").unlink()
        (self.root / "site/index.html").symlink_to("../private-notes.txt")
        self.commit()
        with self.assertRaisesRegex(ValueError, "Unexpected public file"):
            publish.export_site(self.root, "HEAD", self.output)

    def test_unexpected_tracked_files_are_rejected(self):
        (self.root / "site/private.env").write_text("not public")
        self.commit()
        with self.assertRaisesRegex(ValueError, "Unexpected public file"):
            publish.export_site(self.root, "HEAD", self.output)


if __name__ == "__main__":
    unittest.main()
