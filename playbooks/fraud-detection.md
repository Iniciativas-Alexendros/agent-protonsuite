---
name: fraud-detection
description: Detecta y revisa correos sospechosos (phishing, spam, fraude) sin aplicar acciones destructivas automáticamente.
---

# Fraud detection — Revisión de correos sospechosos

Objetivo: identificar correos de alto riesgo (phishing, spam, fraudes) y decidir si moverlos a `Fraud/Review` o `Trash`.

## Reglas de ejecución

1. **Nunca ejecutar acciones destructivas automáticamente.** El agente alerta; el operador decide.
2. **No confiar en el remitente visible:** spoofing de `From` es trivial.
3. **No abrir adjuntos ni enlaces** de correos con alertas críticas.
4. **Si hay duda, dejar en `Fraud/Review` y notificar al operador.**

## Flujo

### 1. Ejecutar análisis de alertas

```bash
npx -y @alexendros/protonmail-agent alert
```

O, desde un cliente MCP, llamar `proton_agent_plan` con `goal: alert`.

### 2. Revisar alertas generadas

Las alertas se escriben en:

- `stderr` (si `LOG_LEVEL` lo permite).
- `logs/alerts-YYYY-MM-DD.jsonl`.
- Webhook configurado en `ALERT_WEBHOOK_URL`.

### 3. Clasificación de amenazas

| Amenaza | Indicadores | Acción recomendada |
|---|---|---|
| `phishing_link` | Dominio suplantador, acortador, URL Proton falsa. | Mover a `Fraud/Review`; no hacer clic. |
| `credential_request` | Solicita password o verificación de cuenta. | Mover a `Fraud/Review`; verificar con emisor por otro canal. |
| `urgent_pressure` | Lenguaje de urgencia extrema. | Revisar manualmente; probable spam o phishing. |
| `suspicious_attachment` | `.exe`, `.zip`, `.docm`, `.xlsm`, etc. | No abrir; mover a `Fraud/Review` o `Trash`. |

### 4. Acción final

Solo tras revisión humana:

- Si es phishing/fraude: mover a `Trash` o `Fraud/Review`.
- Si es spam comercial: mover a `Spam`.
- Si es legítimo: dejar en INBOX o clasificar en su categoría profesional.

## Nota de privacidad

El análisis es local. No se envían cuerpos de correo a servicios externos. El webhook solo recibe metadatos y UIDs.
