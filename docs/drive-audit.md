# Auditoría y operación de Proton Drive (CLI oficial)

El agente integra **Proton Drive** a través del binario oficial
[`proton-drive`](https://proton.me/support/drive-cli) (basado en el SDK de
Proton Drive). El agente no habla directamente con la API ni almacena
credenciales de Drive: ejecuta el CLI, parsea su salida JSON y normaliza los
errores. Las tools MCP y los agent goals de Drive solo se registran cuando
`DRIVE_ENABLED=true` y el binario responde a `--version`.

## Prerrequisitos

- **Node ≥ 22** (igual que el resto del agente).
- **El CLI oficial** `proton-drive` instalado y accesible en el `PATH`
  (o vía `DRIVE_CLI_BIN`). Se descarga desde
  [proton.me/support/drive-cli](https://proton.me/support/drive-cli).
- **Auth one-off**: el operador debe ejecutar `proton-drive auth login` una
  sola vez antes de usar las herramientas. El CLI persiste el token localmente.
- **Proton Mail Bridge no es necesario** para Drive; Drive usa su propia
  autenticación dentro del CLI.

Verifica la instalación:

```bash
proton-drive --version
proton-drive filesystem list /my-files --json
```

## Configuración

Todas las variables viven en `.env` (ver `.env.example`, sección _Proton Drive_).
Las tools MCP y los agent goals de Drive se activan con `DRIVE_ENABLED=true`
(por defecto). Si prefieres usar el binario en una ruta que no está en
`PATH`, ajusta `DRIVE_CLI_BIN`.

| Variable                    | Default                   | Descripción                                                      |
| --------------------------- | ------------------------- | ---------------------------------------------------------------- |
| `DRIVE_ENABLED`             | `true`                    | Gate maestro. `false` desactiva Drive sin tocar el resto.        |
| `DRIVE_CLI_BIN`             | `proton-drive`            | Path al binario del CLI.                                         |
| `DRIVE_STAGING_DIR`         | `~/.proton-drive/staging` | Directorio local usado como staging para auditoría/organización. |
| `DRIVE_OBSOLETE_EXTENSIONS` | `.doc,.ppt,.xls,.bmp`     | Extensiones consideradas obsoletas (CSV).                        |

Ejemplo de `.env`:

```bash
DRIVE_ENABLED=true
DRIVE_CLI_BIN=proton-drive
DRIVE_STAGING_DIR=~/.proton-drive/staging
DRIVE_OBSOLETE_EXTENSIONS=.doc,.ppt,.xls,.bmp
```

> Las credenciales de Proton Drive **no** viven en este agente ni en `.env`;
> el CLI las guarda cifradas en `~/.config/proton-drive/` tras `auth login`.

## Persistencia del token del CLI

El CLI oficial guarda su sesión (tokens + clave SRP) en
`~/.config/proton-drive/` por defecto. Conviene montar ese directorio como
volumen para que sobreviva a recreaciones del contenedor Docker. En
`docker-compose.yml` ya está cableado:

```yaml
volumes:
  - drive-auth-data:/home/node/.config/proton-drive
```

### Primer arranque (login interactivo)

```bash
# 1. Construir y arrancar la pila (sin logs ruidosos)
docker compose build agent
docker compose up -d proton-bridge
docker compose up -d agent

# 2. Login una sola vez — abre navegador y autoriza la app
docker compose exec agent proton-drive auth login

# 3. Verificar que el token se persistió
docker compose exec agent proton-drive filesystem list /my-files --json
```

A partir de este momento el volumen `drive-auth-data` conserva el token para
todos los arranques siguientes. Si montas ese mismo volumen en una segunda
instalación del agente (mismo host o DR compartido), el login ya es válido.

### Renovar el token

```bash
docker compose exec agent proton-drive auth login --refresh
```

Si sospechas compromiso del token:

```bash
docker compose exec agent proton-drive auth logout
# Vuelve a iniciar sesión con `auth login`.
```

## Uso: agent goals (CLI)

Los goals se invocan con `protonsuite-agent` o vía los npm scripts. Si la
configuración de Drive falta o el binario no responde, el agente termina con
código `2`.

| Goal             | npm script                     | Qué hace                                                                                       | Dry-run                            |
| ---------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------- |
| `drive-audit`    | `npm run agent:drive-audit`    | Inventario + duplicados + formatos obsoletos sobre el staging. Solo lectura.                   | Siempre                            |
| `drive-organize` | `npm run agent:drive-organize` | Reorganiza el staging por tipo (`docs/`, `images/`, `media/`, `audio/`, `archives/`, `data/`). | Por defecto (`AGENT_DRY_RUN=true`) |
| `drive-list`     | `npm run agent:drive-list`     | Lista archivos de `/my-files` en Proton Drive (salida JSON del CLI).                           | Sí (read-only)                     |
| `drive-download` | `npm run agent:drive-download` | Descarga `/my-files` al staging (`filesystem download`).                                       | No                                 |
| `drive-upload`   | `npm run agent:drive-upload`   | Sube el staging a `/my-files` (`filesystem upload`).                                           | No                                 |

Ejemplos:

```bash
npx protonsuite-agent drive-audit
npm run agent:drive-organize
AGENT_DRY_RUN=false npm run agent:drive-organize  # aplica los movimientos
npm run agent:drive-download
```

`drive-organize` respeta `AGENT_DRY_RUN` (por defecto `true`); defínelo en
`false` para aplicar los movimientos sugeridos sobre el staging local. Los
cambios solo suben a Drive tras un `proton_drive_upload` (manual o
programado).

## Uso: tools MCP

Estas tools se registran en `tools/list` únicamente cuando `DRIVE_ENABLED=true`
y el binario responde.

| Tool                         | Tipo             | Descripción                                                                                             |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `proton_drive_status`        | read             | Estado del binario CLI (`auth status`) + existencia y tamaño del staging.                               |
| `proton_drive_list_files`    | read             | Lista un path remoto. Params: `remote_path` (default `/my-files`), `response_format`.                   |
| `proton_drive_download`      | write idempotent | Descarga un path remoto al staging. Params: `remote_path`, `local_path` opcional.                       |
| `proton_drive_upload`        | write            | Sube el staging a Proton Drive. Params: `local_path` opcional, `remote_path` (default `/my-files`).     |
| `proton_drive_share`         | write idempotent | Invita a un usuario Proton. Params: `remote_path`, `user_email`.                                        |
| `proton_drive_audit`         | read             | Inventario + duplicados (hash SHA-256) + formatos obsoletos del staging. Acepta `staging_dir` opcional. |
| `proton_drive_organize`      | write            | Reorganiza el staging por tipo. `dry_run` por defecto `true`.                                           |
| `proton_drive_format_report` | read             | Reporte detallado de formatos (extensiones, obsoletos, sin extensión). Acepta `staging_dir` opcional.   |

Las tools de lectura aceptan `response_format: "markdown" | "json"`.

Ejemplos de llamada:

```json
// Listado remoto (markdown por defecto)
{ "remote_path": "/my-files/Documents" }

// Iniciar descarga a staging
{ "remote_path": "/my-files/Pictures" }

// Invitar a un usuario
{ "remote_path": "/my-files/Documents", "user_email": "friend@proton.me" }

// Auditoría sobre staging_dir alternativo
{ "staging_dir": "/mnt/backup", "response_format": "json" }
```

## Comportamiento dry-run

Drive hereda el principio de _no tocar nada sin confirmación_ del agente de
Mail:

- **`drive-audit`** y **`proton_drive_audit`**: siempre solo lectura.
- **`drive-organize`** y **`proton_drive_organize`**: `dry_run` por defecto
  `true` (tool) o `AGENT_DRY_RUN=true` (goal). En dry-run solo presenta el
  plan de movimientos (`from` → `to`) sin ejecutarlos. Cambiar a `false`
  aplica los movimientos sobre el staging local.
- **`proton_drive_download`** y **`drive-download`**: idempotentes — re-ejecutar
  no corrompe; el CLI reescribe los locales solo si difieren.
- **`proton_drive_upload`** y **`drive-upload`**: no idempotentes. Aplican
  tras un `drive-organize` aplicado. Recomendado: revisar el plan antes
  de subir. Subidas múltiples sobre la misma ruta pueden sobrescribir.
- **`proton_drive_share`**: idempotente — re-invitar no duplica el acceso.

```bash
# Plan de organización sin aplicar
npm run agent:drive-organize

# Aplicar movimientos al staging local
AGENT_DRY_RUN=false npm run agent:drive-organize

# Subir a Proton Drive desde una tool MCP (drive-upload tool,
# recomendada con confirmación humana; evita subidas accidentales):
# → tool: proton_drive_upload
# → arguments: { "remote_path": "/my-files" }
```

## Troubleshooting

| Síntoma                                                | Causa probable                                           | Solución                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `proton-drive error: proton-drive not found` en el log | El binario no está en `PATH` ni en `DRIVE_CLI_BIN`.      | Instalar CLI o ajustar `DRIVE_CLI_BIN` a la ruta absoluta.                     |
| `auth status` falla con `not authenticated`            | No se hizo `proton-drive auth login`.                    | Login una sola vez (ver sección _Persistencia del token_).                     |
| `listFiles` devuelve `files: []` sin error             | El path remoto apunta a un directorio vacío o no existe. | Verificar el path con el cliente web de Proton Drive.                          |
| `share` falla con `proton-drive error: ...`            | El usuario invitado no es una cuenta Proton válida.      | Verificar el email y que esté escrito en minúsculas.                           |
| Tras reconstruir Docker, Drive vuelve a fallar         | El volumen `drive-auth-data` no se montó.                | Definir el volumen en `docker-compose.yml` y persistirlo.                      |
| Staging muy lento en descargas                         | CLI sin caché persistente o red saturada.                | Reducir concurrencia; el CLI no acepta `--transfers` aún (consultar `--help`). |

## Referencias

- [Proton Drive CLI — soporte oficial](https://proton.me/support/drive-cli)
- [`docs/superpowers/specs/2026-07-10-proton-drive-rsync-audit-design.md`](./superpowers/specs/2026-07-10-proton-drive-rsync-audit-design.md) (histórico)
- Roadmap en [`ROADMAP.md`](../ROADMAP.md) — bloque _Drive MVP_.
