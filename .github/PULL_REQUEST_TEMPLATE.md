<!--
Thanks for opening a PR. Please fill in the sections below — they make review faster
and reduce the back-and-forth. If your PR is a draft for early feedback, that's fine
too; just say so in the description.

Security vulnerabilities: do NOT submit them as a public PR. Email
security@alexendros.me first. See SECURITY.md.
-->

## Summary

<!-- 1-3 sentences: what changes, why. Link to the issue this closes (e.g. "Closes #42"). -->

## Type of change

<!-- Check one. -->

- [ ] 🐛 Bug fix (non-breaking)
- [ ] ✨ New feature (non-breaking)
- [ ] 💥 Breaking change (bumps SemVer major)
- [ ] 🧹 Refactor / internal cleanup (no behaviour change)
- [ ] 📝 Docs / examples
- [ ] 🔧 Build / CI / tooling

## How was this tested?

<!--
Describe what you ran. Examples:
  - `npm test` — all passing locally
  - Smoke against a local Bridge with `npm run smoke`
  - Manual curl against the HTTP transport on `:3000`
-->

## Checklist

- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` passes.
- [ ] `npm run build` succeeds; `dist/` was NOT committed.
- [ ] If a new tool was added, it's documented in the README tools table and exposed via `tools/list` in `src/server.ts`.
- [ ] If a new agent feature was added, it's documented in `docs/` and `playbooks/` and has tests.
- [ ] If env vars changed, both `.env.example` and the README env table were updated.
- [ ] If the threat model changed, `SECURITY.md` reflects it.
- [ ] License compatibility checked: `npm run license-check` and `npm run license-check:prod` pass.
- [ ] No references to exclusive clients (Claude, Anthropic, etc.) in README/docs.
- [ ] No secrets, tokens, or personal email addresses in commits, comments, or fixtures.
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat(imap): add archive tool`, `fix(http): close session on auth failure`).

## Notes for reviewer

<!-- Optional: open questions, design choices you're unsure about, follow-ups left out. -->
