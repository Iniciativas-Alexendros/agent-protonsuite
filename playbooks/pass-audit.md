---
name: pass-audit
description: Auditoría de fortaleza del vault de Proton Pass — contraseñas débiles, duplicados y rotación pendiente.
---

# Auditoría de Proton Pass

## Objetivo

Revisar la fortaleza del vault de contraseñas de Proton Pass: contraseñas débiles, duplicadas y entradas que necesitan rotación.

## Prerrequisitos

- `pass` CLI instalado (`apt install pass`).
- `PROTON_PASS_ENABLED=true` en el entorno.
- `PROTON_PASS_STORE_DIR` apuntando al password store (default: `~/.password-store`).

## Flujo

### 1. Verificar conectividad

```bash
npx -y @alexendros/protonsuite-agent pass-audit
```

### 2. Revisar el informe

El agente emite:

- **Total de entradas** en el vault.
- **Contraseñas débiles** (< 12 caracteres o poca variedad de tipos).
- **Entradas duplicadas** (misma contraseña en múltiples paths).
- **Recomendaciones** priorizadas.

### 3. Regenerar contraseñas débiles

Para cada entrada débil detectada, usar la tool `proton_pass_generate` desde cualquier cliente MCP:

```
proton_pass_generate path="servicios/entry-debil" length=24
```

La tool confirma `{generated: true, path, length}` sin revelar el valor.

### 4. Unificar duplicados

Si dos entradas comparten contraseña:

1. Decidir cuál es la fuente canónica.
2. Regenerar las entradas derivadas con `proton_pass_generate`.
3. Actualizar los servicios correspondientes.

## Verificación

```bash
npx -y @alexendros/protonsuite-agent pass-audit
```

El informe debe mostrar 0 contraseñas débiles y 0 duplicados.

## Seguridad

- Las contraseñas **nunca** se exponen en logs, stdout, o respuestas MCP.
- La auditoría evalúa localmente — sin envío a servicios externos.
- Las contraseñas generadas usan `crypto.randomBytes` del runtime Node.js.
