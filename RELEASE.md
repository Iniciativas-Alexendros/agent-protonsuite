# Procedimiento de release de protonmail-mcp

Las releases siguen [SemVer 2.0.0](https://semver.org/lang/es/) y se
publican a través de tags firmados.

## Antes de la release

- Todos los cambios relevantes están en `CHANGELOG.md` bajo `[Sin publicar]`.
- El CI está verde en `main`.
- La documentación está actualizada (README, ARCHITECTURE, docs/).
- Se han verificado las dependencias con `pnpm audit` o herramienta
  equivalente.

## Pasos

1. Mover los cambios de `[Sin publicar]` a una nueva sección con número de
   versión y fecha en `CHANGELOG.md`.
2. Actualizar la versión en `package.json` (o el manifest correspondiente).
3. Crear commit `chore(release): vX.Y.Z`.
4. Crear tag firmado: `git tag -s vX.Y.Z -m "vX.Y.Z"`.
5. Empujar tag y rama: `git push --follow-tags`.
6. Crear release en GitHub copiando la sección del CHANGELOG.
7. Verificar que el workflow de release publicó los artefactos esperados.

## Versionado

- `MAJOR` para cambios incompatibles.
- `MINOR` para nuevas funcionalidades retrocompatibles.
- `PATCH` para correcciones retrocompatibles.

## Hotfix

Para correcciones críticas en una versión publicada:

1. Rama `hotfix/vX.Y.Z+1` desde el tag.
2. Aplicar la corrección y bumpear `PATCH`.
3. Seguir los pasos estándar.
4. Mergear de vuelta a `main` para no perder la corrección.
