# Procedimiento de release de Proton Suite Agent

Las releases se gestionan automáticamente con [semantic-release](https://github.com/semantic-release/semantic-release) a partir de los [Conventional Commits](https://www.conventionalcommits.org/).

## Cómo funciona

1. Cada commit en `main` sigue el formato conventional commit (`feat:`, `fix:`, `BREAKING CHANGE:`).
2. commitlint + Husky bloquean commits no conformes en local; el workflow `pr-title.yml` valida el título del PR (squash-merge → mensaje que analiza semantic-release).
3. Al hacer push a `main`, el workflow `release.yml` ejecuta `semantic-release`:
   - Analiza los commits desde el último release (tag).
   - Determina la próxima versión (MAJOR, MINOR o PATCH).
   - Genera/actualiza `CHANGELOG.md` en el workspace del job.
   - Crea un GitHub Release y el tag `vX.Y.Z` (`@semantic-release/github`).
   - **No publica a npm** mientras `@alexendros/protonsuite-agent` no exista en el registry y Trusted Publishing no esté listo (ver [docs/publishing.md](./docs/publishing.md)).
4. Si hubo release nueva, `publish-ghcr` construye desde el tag `vX.Y.Z` y publica `:latest`, `:X.Y.Z`, `:X.Y` y `:sha-…`.
5. Dry-run: `gh workflow run release.yml -f dry-run=true`, o cualquier PR que toque el workflow (no publica GitHub/GHCR).
6. Commits `chore:` / `docs:` / `ci:` (sin `feat`/`fix`/`BREAKING CHANGE` desde el último tag) no crean versión. El job termina en verde.

## Publicación

- **npm:** Desactivado (`npmPublish: false`). No se usa `NPM_TOKEN`. Cuando el paquete exista y OIDC Trusted Publishing esté configurado en npmjs.com, se puede volver a `true` (ver [docs/publishing.md](./docs/publishing.md)).
- **GitHub Release + tag:** Fuente de verdad de la versión. `package.json` puede quedar desfasado (hoy `1.2.1` vs tags `v1.3.x`) porque no se hace push a `main` con `@semantic-release/git` (protegida, GH006).
- **GHCR:** Imagen Docker multi-tag (`:latest`, `:vX.Y.Z`, `:vX.Y`, `:sha-XXXXX`) solo cuando semantic-release publica una versión.
- **Provenance:** Docker build usa `provenance: true`. npm provenance queda para cuando se reactive Trusted Publishing.
- **PR metadata:** `release-preview.yml` comenta el bump previsto; `@semantic-release/github` aplica el label `released` a PRs incluidos en la release.

## Hotfix

Si se necesita un hotfix, crear una rama `hotfix/<slug>` desde `main`, hacer el fix, y mergear de vuelta a `main`. Semantic-release detectará el `fix:` y hará un PATCH bump.
