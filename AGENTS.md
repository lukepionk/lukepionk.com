# Personal website

This repository builds Luke Pionk's personal website at lukepionk.com.

- Keep v1 to Header, Now, Resources, Work, and Contact.
- Use plain language and verifiable public examples. Never publish employer
  internals, source material from resumes, private project notes, or invented
  projects, endorsements, metrics, and personal reading habits.
- Use static HTML and CSS unless a real requirement needs more.
- Aim for near-zero recurring cost. Keep domain registration and DNS at Porkbun.
- AWS commands must explicitly use `--profile lpionk_cli`. Do not refresh or
  replace these credentials.
- Production changes require explicit authorization for this website. Prepare
  a reviewable local result before requesting authorization when needed.
- Deploy only files under `site/` from an identified, clean Git commit.
  Never sync the repository root to S3.
- If a remote is configured, push and verify the deployed commit there.
- Put design decisions in `docs/design/specs/`; keep research extracts,
  previews, and deployment state in ignored directories.
