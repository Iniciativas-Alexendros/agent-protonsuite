# Changelog

Changelog generado automáticamente por [semantic-release](https://github.com/semantic-release/semantic-release) a partir de los [Conventional Commits](https://www.conventionalcommits.org/).

El formato sigue [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) y [SemVer 2.0.0](https://semver.org/).

## [Unreleased]

### Fixed

- **ci:** E2E GreenMail deja de usar `continue-on-error` y es required check ([#107](https://github.com/Iniciativas-Alexendros/agent-protonsuite/pull/107)).
- **ci:** Pre-commit/husky ejecuta actionlint pinneado vía `scripts/run-actionlint.sh` (sin `docker://…:latest`) ([#107](https://github.com/Iniciativas-Alexendros/agent-protonsuite/pull/107)).

### Changed

- **labels:** Taxonomía `type:` / `area:` / `priority:` / `status:` / `release:`; claves citadas en `.github/labeler.yml` ([#107](https://github.com/Iniciativas-Alexendros/agent-protonsuite/pull/107)).

## [1.4.0] - 2026-09-23

### Added

- Rate tiers HTTP por clase de tool, caché IMAP con invalidación por fingerprint, mutex de paths Drive y gate de Calendar experimental ([915c596](https://github.com/Iniciativas-Alexendros/agent-protonsuite/commit/915c5963c37a09d6098deef036c73ee5fed21f6c)).
- Robustez HTTP/IMAP/Drive + Subfase 0 docs y Pass `gopass` ([#103](https://github.com/Iniciativas-Alexendros/agent-protonsuite/pull/103)).

### Fixed

- **ci:** Release ya no falla en `verifyConditions` de npm (`EINVALIDNPMTOKEN` / OIDC 404). `npmPublish: false` hasta que exista `@alexendros/protonsuite-agent` y Trusted Publishing; no se inventa `NPM_TOKEN`. GitHub Release + GHCR siguen siendo la superficie de publicación ([#106](https://github.com/Iniciativas-Alexendros/agent-protonsuite/pull/106)).
- **ci:** Integration schedule/PR en runner hosted salta smokes de Bridge/Pass/Drive si no hay credenciales o binarios (ENOENT / ECONNREFUSED). Bridge real solo con `workflow_dispatch` + `bridge-real=true` ([#106](https://github.com/Iniciativas-Alexendros/agent-protonsuite/pull/106)).
- **release:** Restaurar pipeline atómico de semantic-release ([ca7ab7d](https://github.com/Iniciativas-Alexendros/agent-protonsuite/commit/ca7ab7dc53cd448d892594eb980af469d9285d79)).

## [1.3.2] - 2026-08-07

### Fixed

- Configure markdownlint and zizmor rules ([e52161e](https://github.com/Iniciativas-Alexendros/agent-protonsuite/commit/e52161ef69f4c3d9587525f824c59a2bb7a3d783)).

## [1.3.1] - 2026-08-07

### Fixed

- Enable npm publish via OIDC trusted publishing ([#98](https://github.com/Iniciativas-Alexendros/agent-protonsuite/pull/98)).

## [1.3.0] - 2026-08-07

### Added

- MCP contract tests, metrics endpoint, and CalDAV interface seam ([#91](https://github.com/Iniciativas-Alexendros/agent-protonsuite/pull/91)).

### Fixed

- Align Calendar stub messages with Proton reality (no CalDAV).
- Harden null checks, remove dead code, extract emailFeatures helper.
- Repair badges, README, and release workflow ([#93](https://github.com/Iniciativas-Alexendros/agent-protonsuite/pull/93)).
- Repair release.yml (remove broken manual commit step).

## [1.2.1] - 2026-07-20

### Fixed

- Restore truncated `agent.test.ts` after merge conflict.
- SHA-256 hash for Pass duplicate detection, `--force` on insert/generate.
- `fs.readdir` for Pass `list()`, reject `..` paths, fix e2e path.

## [1.2.0] - 2026-07-20

### Added

- **Branch Hunt 2** + ESLint `off→warn` bajo riesgo (coverage improvement).

## [1.1.0] - 2026-07-19

### Changed

- **TypeScript strict flags**: enabled `noImplicitOverride` + `exactOptionalPropertyTypes` in tsconfig.

## [1.0.1] - 2026-07-17

## [1.0.0] - 2026-07-12

### BREAKING

- **Rebrand a Proton Suite Agent v1.0.0**: el proyecto abarca Mail, Pass, Calendar y Drive. Package renombrado a `@alexendros/protonsuite-agent`, binarios `protonsuite-*`, repo `agent-protonsuite`. Commit BREAKING CHANGE desde v0.5.0 → bump semver major a v1.0.0.
