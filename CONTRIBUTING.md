# Contributing to `@alexendros/protonmail-mcp`

Thanks for thinking about contributing. This is a small, focused project — its scope is intentionally narrow ("expose Proton Mail capabilities to MCP clients **through Bridge**, never around it"). Reading this once will save us both round-trips.

> 🔒 **Security?** Do NOT open a public issue or PR. Email **security@alexendros.me** or use [GitHub Security Advisories](https://github.com/Iniciativas-Alexendros/plugin-protonmail-claudecode/security/advisories/new). See [SECURITY.md](./SECURITY.md) for the full threat model.

## Ways to contribute

- **🐛 Report a bug** — use the [Bug report template](./.github/ISSUE_TEMPLATE/bug-report.yml). Include version, transport, Node, OS, repro steps.
- **💡 Propose a feature** — use the [Feature request template](./.github/ISSUE_TEMPLATE/feature-request.yml). Be concrete (tool name, inputs, outputs). Bridge-only scope, no direct Proton web API calls.
- **💬 Ask a question** — use [Discussions](https://github.com/Iniciativas-Alexendros/plugin-protonmail-claudecode/discussions), not the issue tracker.
- **🧑‍💻 Send a patch** — see "Pull request workflow" below.

## Pull request workflow

1. **Find or open an issue first.** PRs without a linked issue may be closed. Discuss the approach before writing code, especially for new tools or breaking changes.
2. **Fork + branch.** Branch naming: `feat/<short-slug>`, `fix/<short-slug>`, `docs/<short-slug>`, `chore/<short-slug>`.
3. **Develop.** Follow the checklist in the [PR template](./.github/PULL_REQUEST_TEMPLATE.md).
4. **Open the PR** against `main`. Fill in the template completely.
5. **Iterate.** Maintainer review usually within a week. Be ready to rebase on `main` rather than merge.
6. **Merge.** Squash-merge by default. The maintainer handles the merge once CI is green and review is approved.

## Local development

Requires Node ≥ 20 and a Proton Mail Bridge running locally (or in Docker).

```bash
# 1. Clone + install
git clone https://github.com/Iniciativas-Alexendros/plugin-protonmail-claudecode.git
cd protonmail-mcp
npm install

# 2. Configure environment
cp .env.example .env
# Fill PROTON_BRIDGE_USER / PROTON_BRIDGE_PASS at minimum.

# 3. Build + verify
npm run build         # tsc → dist/
npm run typecheck     # tsc --noEmit
npm test              # vitest run (39 tests)
npm run smoke         # end-to-end smoke against the running Bridge

# 4. Run locally
npm start             # stdio transport
# or
PORT=3000 node dist/index.js  # HTTP transport on :3000
```

For HTTP development, the [MCP inspector](https://github.com/modelcontextprotocol/inspector) is your friend:

```bash
npm run inspect
```

## Coding conventions

- **Language:** TypeScript strict (`"strict": true`). No new `any` without a comment explaining why.
- **Modules:** ES Modules (`"type": "module"`). Use named exports.
- **Error handling:** validate at boundaries with Zod (`src/config.ts` is the reference). Never swallow errors silently — log to stderr and rethrow or return a typed error.
- **Logging:** stderr only. The stdio transport reserves stdout for protocol traffic. Use the existing logger pattern in `src/config.ts`.
- **Tests:** Vitest. Add tests in `tests/`. Mirror the file layout (`src/foo.ts` → `tests/foo.test.ts`). Tests must be deterministic — no real network, no real Bridge in unit tests.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat(imap):`, `fix(http):`, `chore(deps):`, `docs:`, `refactor:`, `test:`, `ci:`).
- **Public API:** anything exported from `src/index.ts` or shipped in the MCP `tools/list` is public. Breaking changes require a SemVer major bump and a `BREAKING CHANGE:` footer in the commit.

## Issue triage policy

When you open an issue you'll see a `triage` label. The maintainer will:

- **Within 7 days:** acknowledge, ask for clarification, or label with severity (`critical` / `bug` / `enhancement` / `wontfix` / `duplicate`).
- **Critical bugs (data loss, auth bypass, secret leak):** patched ASAP, hotfix release.
- **Bugs:** scheduled for the next minor release.
- **Features:** evaluated against scope; may be deferred or declined with explanation.
- **Stale issues:** issues without a response from the reporter for 30 days may be closed with a `stale` label. Comment to reopen.

## Code of Conduct

Participation is governed by the [Contributor Covenant](./CODE_OF_CONDUCT.md). Violations: report to **conduct@alexendros.me**.

## License

By submitting a PR you agree that your contribution is licensed under the [MIT License](./LICENSE) of this repository.
