# Auditoría y organización de Proton Drive

El agente integra **Proton Drive** a través de [`rclone`](https://rclone.org/protondrive/), que es quien se comunica con la API de Proton Drive. El agente no habla directamente con Drive: sincroniza el contenido a un directorio de _staging_ local y opera sobre él (inventario, duplicados, formatos, reestructuración). Las tools MCP y los agent goals de Drive solo se registran cuando está configurado el remote de rclone (`DRIVE_RCLONE_REMOTE`).

## Prerrequisitos

- **Node ≥ 22** (igual que el resto del agente).
- **[`rclone`](https://rclone.org/install/)** instalado y accesible en el `PATH` (o vía `DRIVE_RCLONE_BIN`).
- **Un remote de rclone configurado** para Proton Drive (ver [Configuración de rclone](#configuración-de-rclone)).
- **Proton Mail Bridge no es necesario** para Drive; Drive usa su propia autenticación dentro de `rclone config`.

Verifica la instalación de rclone:

```bash
rclone --version
rclone lsd proton-drive:   # sustituye por el nombre de tu remote
```

## Configuración

Todas las variables viven en `.env` (ver `.env.example`, sección _Proton Drive_). Las tools MCP y los agent goals de Drive se activan **solo si** `DRIVE_RCLONE_REMOTE` está definido.

| Variable                    | Default                | Descripción                                                                                      |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `DRIVE_RCLONE_REMOTE`       | —                      | Nombre del remote configurado en rclone (ej. `proton-drive:`). **Requerido** para activar Drive. |
| `DRIVE_STAGING_DIR`         | `~/.protonmail/drive/` | Directorio local donde rclone sincroniza el contenido de Drive.                                  |
| `DRIVE_SYNC_MODE`           | `pull`                 | Modo de sincronización: `pull` (sync explícito) o `watch` (montaje FUSE).                        |
| `DRIVE_RCLONE_BIN`          | `rclone`               | Ruta al binario de rclone.                                                                       |
| `DRIVE_OBSOLETE_EXTENSIONS` | `.doc,.ppt,.xls,.bmp`  | Extensiones consideradas obsoletas, separadas por coma.                                          |

Ejemplo de `.env`:

```bash
DRIVE_RCLONE_REMOTE=proton-drive:
DRIVE_STAGING_DIR=~/.protonmail/drive/
DRIVE_SYNC_MODE=pull
DRIVE_RCLONE_BIN=rclone
DRIVE_OBSOLETE_EXTENSIONS=.doc,.ppt,.xls,.bmp
```

> Las credenciales de Proton Drive viven en `rclone config` (su propio config cifrado), **no** en el agente ni en `.env`.

## Uso: agent goals (CLI)

Los goals se invocan con el binario `protonsuite-agent` o vía los npm scripts equivalentes. Requieren `DRIVE_RCLONE_REMOTE` configurado; si no, el agente termina con código `2`.

| Goal             | npm script                     | Qué hace                                                                                                                                      | Dry-run                            |
| ---------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `drive-audit`    | `npm run agent:drive-audit`    | Escanea el staging y genera inventario + reporte de formato + duplicados + espacio. Solo lectura.                                             | Siempre                            |
| `drive-organize` | `npm run agent:drive-organize` | Igual que `drive-audit` y propone/aplica la reestructuración (mover por tipo a `docs/`, `images/`, `media/`, `audio/`, `archives/`, `data/`). | Por defecto (`AGENT_DRY_RUN=true`) |
| `drive-sync`     | `npm run agent:drive-sync`     | Sincroniza el staging con Proton Drive (pull por defecto; el push es manual vía la tool `proton_drive_sync` con `direction=push`).            | No                                 |

Ejemplos:

```bash
npx protonsuite-agent drive-audit
npm run agent:drive-organize
npm run agent:drive-sync
```

`drive-organize` respeta `AGENT_DRY_RUN` (por defecto `true`): en dry-run solo presenta el plan de movimientos; para aplicar los cambios, define `AGENT_DRY_RUN=false`:

```bash
AGENT_DRY_RUN=false npm run agent:drive-organize
```

## Uso: tools MCP

Estas tools se registran en `tools/list` únicamente cuando `DRIVE_RCLONE_REMOTE` está definido. Aceptan `response_format: "markdown" | "json"` (salvo `proton_drive_sync` y `proton_drive_organize`).

| Tool                         | Tipo  | Descripción                                                                                                                                       |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proton_drive_audit`         | read  | Escanea el staging y devuelve: total de archivos, por tipo/tamaño, duplicados (hash SHA-256) y formatos obsoletos. Acepta `staging_dir` opcional. |
| `proton_drive_status`        | read  | Estado de sincronización: remote alcanzable, modo, existencia y tamaño del staging.                                                               |
| `proton_drive_organize`      | write | Analiza el staging y mueve archivos a una estructura por tipo. **Dry-run por defecto** (`dry_run: true`).                                         |
| `proton_drive_format_report` | read  | Reporte detallado de formatos: extensiones, sin extensión y archivos obsoletos. Acepta `staging_dir` opcional.                                    |
| `proton_drive_sync`          | write | Dispara `rclone sync`. `direction: pull                                                                                                           | push | both`(default`pull`). Idempotente. |

Ejemplo de llamada (`proton_drive_organize` en dry-run, formato JSON):

```json
{ "dry_run": true }
```

Ejemplo de llamada (`proton_drive_sync` push):

```json
{ "direction": "push" }
```

## Configuración de rclone

El agente delega toda la comunicación con Proton Drive a rclone, así que primero hay que dar de alta el remote.

### 1. Crear el remote

```bash
rclone config
```

Selecciona `n` (new remote), ponle un nombre (ej. `proton-drive`) y elige el tipo `protondrive`. rclone pedirá:

- **Proton account username** (tu email de Proton).
- **Proton account password** (la contraseña de la cuenta, no la del Bridge de Mail).
- Confirmar el acceso OAuth en el navegador cuando rclone lo solicite.

El backend `protondrive` necesita el permiso de **Drive (lectura y escritura)** concedido durante el flujo OAuth. Si solo vas a auditar en local con `drive-sync` en modo `pull`, basta con el alcance de lectura; para `proton_drive_sync direction=push` o `drive-organize` aplicado se requiere escritura.

### 2. Verificar el remote

```bash
rclone lsd proton-drive:
rclone about proton-drive:
```

Si ves tus carpetas de Drive, el remote funciona. Apunta `DRIVE_RCLONE_REMOTE` a ese nombre con los dos puntos (ej. `proton-drive:`).

### 3. Modo `watch` (opcional)

Con `DRIVE_SYNC_MODE=watch`, el agente espera un montaje FUSE del remote en lugar de un `rclone sync` explícito. El montaje se gestiona con `rclone mount` (el `DriveClient` lo expone vía `mount`/`unmount`). El modo `pull` (default) es el recomendado para los agent goals, que disparan `rclone sync` bajo demanda.

## Comportamiento dry-run

El principio de _no tocar nada sin confirmación_ se aplica a Drive igual que al correo:

- **`drive-audit`** y **`proton_drive_audit`**: siempre solo lectura; no mueven ni modifican archivos.
- **`proton_drive_organize`**: `dry_run` es `true` por defecto. En dry-run devuelve el plan de movimientos sugeridos (`from` → `to`) sin ejecutarlos. Pásalo a `false` para aplicar.
- **`drive-organize`** (agent goal): respeta `AGENT_DRY_RUN` (default `true`). En dry-run registra el plan y sale; con `AGENT_DRY_RUN=false` aplica los movimientos en el staging local. Los cambios solo suben a Proton Drive tras un `proton_drive_sync direction=push` explícito.
- **`proton_drive_sync`**: el agent goal `drive-sync` solo hace **pull**. El **push** es siempre manual (tool con `direction=push` o `both`) para evitar subidas accidentales.

```bash
# Ver el plan sin mover nada (comportamiento por defecto)
npm run agent:drive-organize

# Aplicar reestructuración en staging local
AGENT_DRY_RUN=false npm run agent:drive-organize

# Subir los cambios a Proton Drive
npx protonsuite-agent protonsuite-mcp   # (desde el cliente MCP)
# → proton_drive_sync { "direction": "push" }
```
