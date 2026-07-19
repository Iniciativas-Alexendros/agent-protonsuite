# Quickstart para humanos — Proton Suite Agent

Este documento te lleva de cero a "leer el inbox con un agente IA" y, opcionalmente, organizar el buzón de forma autónoma.

## Qué necesitas

- **Node ≥ 22** instalado. En Ubuntu 26.04: `sudo apt install nodejs npm`.
- Una cuenta **Proton Mail**.
- **Proton Mail Bridge** headless instalado (`protonmail-bridge-core`).
  En Ubuntu 26.04: descarga el .deb desde https://proton.me/mail/bridge
  e instala con `sudo dpkg -i protonmail-bridge*.deb && sudo apt install -f`.

## 1. Arrancar Proton Mail Bridge

```bash
protonmail-bridge-core --cli
```

Dentro de la consola de Bridge:

```text
>>> login      # introduce tu cuenta Proton, contraseña y 2FA
>>> info       # copia el campo "Password" (bridge password, no tu password Proton)
>>> exit
```

Verifica que escucha en local:

```bash
ss -ltn | grep -E '127.0.0.1:1143'
```

## 2. Instalar el agente

Opción A: usar el paquete npm (recomendado):

```bash
npx -y @alexendros/protonsuite-agent setup
```

Opción B: clonar y construir:

```bash
git clone https://github.com/Iniciativas-Alexendros/agent-protonsuite.git
cd agent-protonsuite
pnpm install
pnpm run build
```

## 3. Verificar conexión

```bash
export PROTON_BRIDGE_USER=you@proton.me
export PROTON_BRIDGE_PASS=your-bridge-password
export PROTON_MAIL_FROM=you@proton.me
npx -y @alexendros/protonsuite-agent setup
```

Si todo va bien, verás las carpetas detectadas y una recomendación para ejecutar `organize`.

## 4. Configurar tu agente

Añade esto a la configuración MCP de tu agente (formato genérico):

```jsonc
{
  "mcpServers": {
    "protonsuite": {
      "command": "npx",
      "args": ["-y", "@alexendros/protonsuite-agent", "protonsuite-mcp"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "PROTON_BRIDGE_USER": "you@proton.me",
        "PROTON_BRIDGE_PASS": "your-bridge-password",
        "PROTON_MAIL_FROM": "you@proton.me",
        "PROTON_BRIDGE_TLS_INSECURE": "true",
        "AGENT_DRY_RUN": "true",
      },
    },
  },
}
```

## 5. No guardes el bridge password en claro

Copia [`connectors/stdio-wrapper.sh.example`](../connectors/stdio-wrapper.sh.example) a tu máquina, rellena tus datos y el puntero a tu gestor de secretos, y usa el wrapper como `command` del MCP en lugar de `npx`. Así el password nunca toca el disco del cliente.

## 6. Organizar el buzón (modo dry-run)

```bash
npx -y @alexendros/protonsuite-agent organize
```

Por defecto, `AGENT_DRY_RUN=true`, así que el agente solo presenta un plan de:

- Carpetas propuestas (`Legal`, `Admin`, `Banca`, `Tech`, etc.).
- Etiquetas sugeridas (`keep`, `spam`, `commercial`, etc.).
- Alertas de seguridad (phishing, spam, fraudes).

Revisa el plan. Si te parece correcto, vuelve a ejecutar con `AGENT_DRY_RUN=false` para aplicar los cambios.

## 7. Primer uso con el agente IA

Reinicia tu agente para que registre el MCP. Luego prueba:

- "¿Qué correos tengo en el inbox?"
- "Resume los correos no leídos de la última semana."
- "¿Hay algo importante de banca o administraciones?"
- "Genera un plan de organización de mi buzón."

El agente llamará a `proton_list_folders` y `proton_agent_plan` automáticamente.

## 8. Siguientes pasos

- Para workflows automáticos: [`playbooks/triage-email.md`](../playbooks/triage-email.md).
- Para organización: [`playbooks/organize-inbox.md`](../playbooks/organize-inbox.md).
- Para desplegar en servidor: [`deployment-http-docker.md`](./deployment-http-docker.md).
- Para problemas con Bridge: [`bridge-core.md`](./bridge-core.md).
- Para alertas: [`alerting.md`](./alerting.md).
- Para el knowledge base de clasificación: [`knowledge-base.md`](./knowledge-base.md).
