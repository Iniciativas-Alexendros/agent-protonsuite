# Proton Mail Bridge headless (`protonmail-bridge-core`)

Esta guía documenta el uso de **`protonmail-bridge-core`**, el paquete _headless_ de
Proton Mail Bridge, como backend IMAP/SMTP local para el MCP. El MCP no habla con
Proton directamente: habla con Bridge en `127.0.0.1`, y Bridge es quien mantiene la
sesión cifrada contra Proton.

> Proton Mail Bridge expone tu buzón Proton como un servidor IMAP/SMTP estándar en
> `localhost`, descifrando y recifrando el correo en local. El MCP es solo un cliente
> IMAP/SMTP más.

## 1. Instalación: paquete headless vs GUI

Hay dos formas de tener Bridge en el sistema, y conviene no confundirlas:

| Paquete                      | Origen                  | Binario                  | Uso                                                                                |
| ---------------------------- | ----------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| **`protonmail-bridge-core`** | Repos oficiales _extra_ | `protonmail-bridge-core` | Headless, sin entorno gráfico. **El recomendado para servidores y para este MCP.** |
| `proton-mail-bin`            | AUR                     | GUI Qt                   | Escritorio con bandeja del sistema. No necesario para el MCP.                      |

El paquete **`protonmail-bridge-core`** no arrastra dependencias de Qt/GUI y se opera
enteramente por CLI, lo que lo hace idóneo para correr junto al MCP en un host sin
sesión gráfica (o en una sesión de usuario systemd).

```bash
# EndeavourOS / Arch (repos oficiales extra)
sudo pacman -S protonmail-bridge-core
```

No instales **a la vez** el paquete GUI de AUR (`proton-mail-bin`) y el headless si
solo necesitas el MCP: ambos comparten el mismo vault en el keychain y mezclarlos
genera confusión sobre qué proceso tiene la sesión viva.

## 2. Arranque en modo CLI

Arranca Bridge en su consola interactiva:

```bash
protonmail-bridge-core --cli
```

Esto abre un prompt propio de Bridge (`>>>`). Los comandos relevantes son:

- `login` — inicia sesión en una cuenta Proton (interactivo: usuario, contraseña, 2FA).
- `info` — muestra los datos de conexión IMAP/SMTP **incluido el bridge password**.
- `list` — lista las cuentas con sesión activa.
- `help` — ayuda integrada.
- `exit` — sale de la consola (Bridge sigue sirviendo en segundo plano si quedó como daemon; en modo `--cli` puro, sale el proceso).

## 3. Login y 2FA

Dentro de la consola:

```text
>>> login
```

Bridge pedirá, de forma **interactiva**:

1. **Cuenta Proton** — tu dirección, p. ej. `you@proton.me`.
2. **Contraseña de la cuenta Proton** — la de tu login de Proton.
3. **Segundo factor (2FA)** — si tienes TOTP activado, el código de 6 dígitos.

Tras un login correcto, Bridge sincroniza el buzón y deja la cuenta lista. **El 2FA
solo se pide en el primer login** (o tras un re-login forzado): la sesión queda
persistida en el keychain del sistema (ver §6), de modo que rearrancar Bridge **no**
vuelve a pedir 2FA.

## 4. Obtener el _bridge password_ con `info`

El **bridge password** es una credencial generada por Bridge, **distinta de la
contraseña de tu cuenta Proton**. Es la que el MCP usa como `PROTON_BRIDGE_PASS`.

```text
>>> info
```

`info` imprime algo equivalente a:

```text
Configuration for you@proton.me

IMAP Settings
Address:   127.0.0.1
IMAP port: 1143
Username:  you@proton.me
Password:  <BRIDGE_PASSWORD_GENERADO>
Security:  STARTTLS

SMTP Settings
Address:   127.0.0.1
SMTP port: 1025
Username:  you@proton.me
Password:  <BRIDGE_PASSWORD_GENERADO>
Security:  STARTTLS
```

Copia el campo **Password** (idéntico para IMAP y SMTP). Ese valor va a
`PROTON_BRIDGE_PASS`. **Nunca lo pegues en claro en el `mcp.json` del cliente ni en el
repo**; gestiónalo con un gestor de secretos (ver
[`local-stdio-secrets.md`](./local-stdio-secrets.md)).

Luego:

```text
>>> exit
```

## 5. Puertos IMAP/SMTP

Tras un login válido, Bridge escucha en local:

- **IMAP**: `127.0.0.1:1143`
- **SMTP**: `127.0.0.1:1025`

Estos son los valores predeterminados que el MCP espera (`PROTON_BRIDGE_IMAP_PORT=1143`,
`PROTON_BRIDGE_SMTP_PORT=1025`, `PROTON_BRIDGE_HOST=127.0.0.1`). Bridge usa un
certificado TLS auto-firmado en `localhost`; por eso el MCP arranca con
`PROTON_BRIDGE_TLS_INSECURE=true` por defecto. Ponlo a `false` solo si has importado la
CA de Bridge en el almacén de confianza del sistema.

## 6. Persistencia en el keychain (gnome-keyring / secret-service)

El vault de Bridge (la sesión Proton y el bridge password) **se persiste en el keychain
del sistema** vía la API **secret-service**. En Linux el backend habitual es
**gnome-keyring**.

Consecuencias prácticas:

- Una vez hecho el login con 2FA, **los rearranques de Bridge no piden 2FA**: leen la
  sesión del keychain.
- Para que Bridge headless pueda escribir/leer el vault, el **secret-service tiene que
  estar disponible y desbloqueado** en la sesión donde corre Bridge. En una sesión de
  usuario gráfica normal, gnome-keyring ya está corriendo y desbloqueado tras el login.
- En sesiones sin entorno gráfico (servidor puro, usuario systemd sin login gráfico),
  hay que asegurar que un agente secret-service esté presente y desbloqueado, o el
  vault no podrá persistirse y Bridge volverá a pedir login en cada arranque.

## 7. Troubleshooting

### El puerto IMAP no escucha

Verifica si Bridge está sirviendo IMAP:

```bash
ss -ltn | grep -E '127.0.0.1:1143'
```

- **Devuelve una línea `LISTEN`** → Bridge está vivo y sirviendo. Si el MCP aún falla,
  el problema es de credenciales (bridge password desactualizado, ver abajo) o de
  `PROTON_BRIDGE_TLS_INSECURE`.
- **No devuelve nada** → Bridge no está sirviendo. Causas típicas:
  - El proceso no está arrancado: lánzalo con `protonmail-bridge-core --cli` (o vía su
    unidad systemd-user si lo tienes como servicio).
  - No hay sesión: ejecuta `login` dentro de la consola CLI.
  - El keychain no estaba desbloqueado y Bridge no pudo leer el vault: desbloquea el
    secret-service y rearranca.

### WARN de arranque que son ruido

Al arrancar, Bridge emite avisos de _bootstrap_ que **no son fallos**:

- WARN sobre la **cache de unleash** (flags remotos no disponibles al inicio).
- WARN sobre la **vault key** durante la inicialización del almacén.

Son parte del arranque normal. Mientras el puerto `1143` acabe en `LISTEN`, ignóralos.

### Re-login regenera el bridge password → reconciliación

**Cada re-login regenera el bridge password.** Si fuerzas un `login` de nuevo (cambio
de contraseña Proton, sesión caducada, reinstalación), el valor que devuelve `info`
**será distinto** del anterior.

Cuando esto ocurra hay que **reconciliar** el nuevo valor:

1. `protonmail-bridge-core --cli` → `info` → copiar el nuevo **Password**.
2. Actualizar el secreto `PROTON_BRIDGE_PASS` en el gestor de secretos (ver
   [`local-stdio-secrets.md`](./local-stdio-secrets.md)). Como el wrapper resuelve el
   secreto _just-in-time_ por puntero `pass://...`, **basta con rotar el valor en el
   gestor**: no hay que tocar el `mcp.json` ni el wrapper.
3. Reiniciar el MCP (o la sesión del cliente) para que recoja el nuevo password.

Si el MCP da errores de autenticación IMAP (`AUTHENTICATIONFAILED`) pero el puerto
`1143` sí escucha, casi siempre es un bridge password desincronizado: reconcílialo.

### `no such user` con la app oficial Proton Mail Beta

La app oficial **Proton Mail Beta para Linux** (paquete `proton-mail` / `proton-mail-beta`)
también expone puertos IMAP/SMTP, pero su Bridge embebido **solo acepta conexiones si la
cuenta está realmente cargada y signed-in en la app**. Si el agente conecta TCP/TLS
correctamente pero Bridge responde `4 NO no such user` para todos los usuarios probados,
la app está abierta pero no tiene la sesión activa:

1. **Cierra completamente** la app Proton Mail Beta (incluyendo el icono de bandeja).
2. **Vuelve a abrirla** e inicia sesión con tu cuenta Proton.
3. Confirma en la interfaz que la cuenta aparece **signed in** y que el apartado de
   configuración de Bridge/Import-Export muestra **IMAP activo**.
4. Reinicia el agente y ejecuta el diagnóstico:

   ```bash
   LOG_LEVEL=debug bash scripts/diagnose-bridge.sh
   # o, si ya tienes el binario instalado:
   LOG_LEVEL=debug npx -y @alexendros/protonsuite-agent check-imap
   ```

Si el diagnóstico responde con las carpetas esperadas (`INBOX`, `Sent`, `Trash`, etc.),
la cuenta está correctamente cargada en Bridge y puedes continuar con `setup` y
`organize` en modo dry-run.
