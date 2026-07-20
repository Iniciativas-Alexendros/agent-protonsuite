# Configuración stdio segura: bridge password _just-in-time_

Este documento describe el patrón recomendado para conectar el MCP en modo **stdio** sin dejar el bridge password en claro en ningún fichero del cliente.

Es el modo primario de uso local. El modo HTTP/Docker queda como modo avanzado, documentado en [`deployment-http-docker.md`](./deployment-http-docker.md).

## 1. El problema: secretos en la configuración del cliente

La forma ingenua de registrar el MCP es poner las env vars directamente en el `mcpServers` del cliente:

```jsonc
// NO HAGAS ESTO
{
  "mcpServers": {
    "protonsuite": {
      "command": "npx",
      "args": ["-y", "@alexendros/protonsuite-agent"],
      "env": {
        "PROTON_BRIDGE_USER": "you@proton.me",
        "PROTON_BRIDGE_PASS": "el-bridge-password-en-claro" // ← secreto en disco
      }
    }
  }
}
```

Problemas:

- El bridge password queda en claro en un fichero de configuración, a menudo sincronizado o respaldado.
- Cada re-login de Bridge regenera el bridge password (ver [`bridge-core.md`](./bridge-core.md) §7), así que el valor en claro caduca.
- El fichero del cliente no es el lugar para gestionar rotación de secretos.

## 2. La solución: un wrapper script como `command`

En lugar de `npx` directo, registra como `command` del MCP un **wrapper shell** que:

1. Exporta las env vars no secretas (host, puertos, usuario, transporte).
2. Resuelve `PROTON_BRIDGE_PASS` just-in-time desde un gestor de secretos, por puntero o por CLI (nunca el valor literal en el wrapper).
3. Lanza el MCP heredando ese entorno.

El `mcpServers` del cliente queda sin secretos:

```jsonc
{
  "mcpServers": {
    "protonsuite": {
      "command": "/ruta/a/protonsuite-agent-stdio.sh"
    }
  }
}
```

## 3. stdout limpio: logs a stderr

**Regla dura del transporte stdio**: el `stdout` del proceso es el canal JSON-RPC. Cualquier byte que no sea JSON-RPC en stdout corrompe la sesión MCP.

Por tanto:

- Todo log, banner o mensaje de bootstrap del gestor de secretos debe ir a **stderr** (`>&2`), nunca a stdout.
- El wrapper no debe imprimir nada en stdout antes de `exec` del MCP.
- Si el gestor de secretos es verboso por defecto, redirige su salida informativa a stderr explícitamente.

## 4. Env-file efímero con `mktemp` + `trap`

Si el gestor de secretos consume un env-file, créalo de forma efímera:

- Crea el fichero con `mktemp` y permisos restrictivos.
- Registra un `trap '... EXIT'` que lo borre al salir, pase lo que pase.
- El env-file solo contiene valores resueltos en runtime; el wrapper no los versiona.

## 5. Ejemplo de wrapper genérico

Plantilla de referencia: [`connectors/stdio-wrapper.sh.example`](../connectors/stdio-wrapper.sh.example). Cópiala, sustituye los placeholders por tu gestor de secretos (Proton Pass, Bitwarden, 1Password, pass-store, gopass, etc.) y regístrala como `command` del MCP.

```bash
#!/usr/bin/env bash
# wrapper stdio seguro para el MCP server de Proton Mail.
# Resuelve PROTON_BRIDGE_PASS JIT desde tu gestor de secretos.
set -euo pipefail

export PROTON_BRIDGE_USER="you@proton.me"
export PROTON_MAIL_FROM="you@proton.me"
export PROTON_BRIDGE_HOST="127.0.0.1"
export PROTON_BRIDGE_IMAP_PORT="1143"
export PROTON_BRIDGE_SMTP_PORT="1025"
export PROTON_BRIDGE_TLS_INSECURE="true"
export MCP_TRANSPORT="stdio"

# Ejemplo: leer desde un gestor de secretos genérico.
# PROTON_BRIDGE_PASS="$(tu-secret-manager read protonmail/bridge-pass)"
# export PROTON_BRIDGE_PASS
#
# o con env-file efímero:
# ENV_FILE="$(mktemp)"
# trap 'rm -f "$ENV_FILE"' EXIT
# tu-secret-manager run --env-file "$ENV_FILE" -- npx -y @alexendros/protonsuite-agent protonsuite-mcp

exec npx -y @alexendros/protonsuite-agent protonsuite-mcp
```

Puntos clave:

- **`exec`** entrega el control al MCP sin un proceso shell intermedio: stdout llega limpio al cliente.
- El bridge password real nunca se almacena en el wrapper versionado ni en la config del cliente.
- `mktemp` + `trap ... EXIT` garantizan que el env-file se borra siempre.
- Sustituye `you@proton.me` por tu cuenta real en tu copia local, no en el repo.
