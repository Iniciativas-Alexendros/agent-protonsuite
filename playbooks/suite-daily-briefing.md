---
name: suite-daily-briefing
description: Briefing diario cross-producto de Proton Suite — Mail, Pass, Calendar y Drive en un solo vistazo.
---

# Briefing diario cross-producto de Proton Suite

## Objetivo

Obtener un resumen unificado del estado de todos los productos configurados: Mail (emails no leídos, alertas), Pass (estado del vault), Calendar (eventos del día, cuando esté disponible) y Drive (archivos modificados, cuando esté disponible).

## Prerrequisitos

- Proton Suite Agent configurado con los productos deseados habilitados.
- Cliente MCP conectado (stdio o HTTP).

## Flujo

### 1. Estado unificado

Usar la tool `proton_suite_status` para obtener el panorama general:

```
proton_suite_status()
```

El resultado incluye:

| Producto | Métrica | Significado |
|---|---|---|
| Mail | `connected`, `mailboxes`, `unread` | ¿Bridge responde? ¿Cuántos correos sin leer? |
| Pass | `connected`, `entries` | ¿Store accesible? ¿Cuántas entradas? |
| Calendar | `available: false` | No disponible aún (CalDAV pendiente) |
| Drive | `available: false` | No disponible aún (OAuth pendiente) |

### 2. Revisar correos no leídos

```
proton_list_emails(mailbox="INBOX", query={unseen:true}, limit=10)
```

### 3. Revisar alertas de seguridad

```
proton_agent_plan(goal="alert")
```

Revisar solo las alertas con severidad `critical` o `alert`.

### 4. Auditoría rápida de Pass (semanal)

Si han pasado 7+ días desde la última auditoría:

```
proton_pass_health()
```

Si `entries` > 0, ejecutar auditoría completa vía CLI:

```bash
npx -y @alexendros/protonsuite-agent pass-audit
```

## Script de ejemplo (agente IA)

```
1. proton_suite_status → ver qué productos están vivos.
2. Si mail.unread > 0: listar no leídos y clasificar.
3. Si hay alertas críticas: revisar emails sospechosos.
4. Si es lunes: proton_pass_health → si entries > 0 y última auditoría > 7 días, sugerir pass-audit.
```

## Verificación

Al final del briefing, el operador debe saber:

- Cuántos emails requieren acción hoy.
- Si hay amenazas de seguridad activas.
- Si el vault de Pass necesita atención.
