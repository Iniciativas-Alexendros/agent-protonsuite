# Despliegue HTTP con Docker (modo avanzado)

> **Modo avanzado.** Para uso local con Claude Code, el modo **stdio** es el primario
> (ver [`local-stdio-secrets.md`](./local-stdio-secrets.md)). Este documento cubre el
> despliegue del MCP en **modo HTTP** sobre Docker, tras un reverse proxy, para
> registrarlo como **Remote MCP Server** en Claude Routines.

En modo HTTP el MCP expone `/mcp` (JSON-RPC sobre HTTP) y `/healthz`, protegidos por un
**bearer token** y una **allowlist de orígenes**.

## 1. Las dos imágenes

El stack se compone de dos contenedores:

| Imagen              | Dockerfile          | Rol                                                                                                                                                             |
| ------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MCP**             | `Dockerfile`        | El servidor MCP en modo HTTP (`MCP_TRANSPORT=http`), Node sobre `node:22-alpine`. Escucha en `8787`.                                                            |
| **Bridge headless** | `Dockerfile.bridge` | Proton Mail Bridge headless (extiende la imagen community `shenxn/protonmail-bridge`) con el vault persistido en un volumen. Sirve IMAP/SMTP en la red interna. |

`Dockerfile.bridge` añade sobre la imagen base las dependencias que faltan en Bridge
recientes (libfido2, dbus-x11, gpg-agent y los _credential helpers_ para el
secret-service), de modo que el vault persista correctamente dentro del contenedor.

## 2. `docker-compose`: red interna + Traefik

El `docker-compose.yml` define:

- Un servicio **`proton-bridge`** (nombre deliberadamente específico para evitar
  colisiones de DNS embebido de Docker con otros stacks que compartan red) que expone
  IMAP/SMTP **solo en la red interna** `proton-net`.
- Un servicio **`mcp`** que depende de `proton-bridge` (con `condition: service_healthy`)
  y habla con él por `proton-net`. El MCP se publica al exterior por la red del reverse
  proxy (p. ej. `dokploy-network`), donde **Traefik** enruta el dominio público hacia el
  puerto `8787`.

El healthcheck de Bridge usa `bash` con `/dev/tcp` (portable, sin binarios extra) para
comprobar que `1143` está vivo antes de arrancar el MCP.

> El bridge IMAP/SMTP **nunca** se publica al exterior: solo el MCP (autenticado) es
> accesible públicamente, y solo a través del reverse proxy.

## 3. Variables de entorno (modo HTTP)

Las relevantes para el modo HTTP, además de las de Bridge:

```bash
# Transporte
MCP_TRANSPORT=http
MCP_HTTP_HOST=0.0.0.0      # dentro del contenedor; el reverse proxy controla el acceso
MCP_HTTP_PORT=8787

# Bearer token — genera uno fuerte:
MCP_AUTH_TOKEN="$(openssl rand -hex 32)"

# Allowlist de orígenes (CSV). Para Claude:
MCP_ALLOWED_ORIGINS=https://claude.ai

# Logging
LOG_LEVEL=info
```

### Allowlist vacía en producción = arranque rechazado

En **`NODE_ENV=production`** el servidor **se niega a arrancar con la allowlist de
orígenes vacía**. Es una protección deliberada: un endpoint HTTP público sin restricción
de `Origin` es un riesgo de CSRF/abuso. Define `MCP_ALLOWED_ORIGINS` (p. ej.
`https://claude.ai`) **antes** de desplegar en producción, o el proceso terminará al
arrancar.

## 4. Login one-off al Bridge headless dentro del contenedor

El primer arranque requiere un **login interactivo único** dentro del contenedor de
Bridge. Una vez hecho, el volumen del vault lo persiste y los siguientes arranques son
automáticos.

```bash
# En el host del despliegue, en el directorio del compose:
docker compose up -d proton-bridge

# Login interactivo one-off:
docker compose run --rm --entrypoint="" proton-bridge \
  /protonmail/proton-bridge --cli
# Dentro de la consola Bridge:
#   login   → cuenta Proton + contraseña + 2FA
#   info    → copiar el campo "Password" (el bridge password generado)
#   exit
```

Pega el bridge password obtenido en **`PROTON_BRIDGE_PASS`** (en las variables del
compose / del panel de despliegue). Recuerda: **cada re-login regenera el bridge
password** y hay que reconciliarlo (ver [`bridge-core.md`](./bridge-core.md) §7).

## 5. Verificación

Sustituye `tu-dominio.example` por tu dominio real.

### Health check

```bash
curl https://tu-dominio.example/healthz
```

Respuesta esperada:

```json
{ "ok": true, "version": "0.4.0", "sessions": 0 }
```

### Handshake MCP (`initialize`)

```bash
curl -X POST https://tu-dominio.example/mcp \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Origin: https://claude.ai" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {},
      "clientInfo": { "name": "curl-smoke", "version": "0.0.0" }
    }
  }'
```

Una respuesta JSON-RPC con `result.serverInfo` confirma que el bearer y el `Origin`
están bien y el MCP responde.

## 6. Registro como Remote MCP Server en Claude Routines

Con el endpoint HTTP verificado, regístralo como **Remote MCP Server**:

```bash
claude mcp add --transport http protonmail-mcp \
  https://tu-dominio.example/mcp \
  --header "Authorization: Bearer $MCP_AUTH_TOKEN"
```

A partir de ahí, Claude Routines puede invocar las herramientas del MCP contra tu
despliegue HTTP autenticado.
