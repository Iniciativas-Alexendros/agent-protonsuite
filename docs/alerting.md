# Alertas de contenido y seguridad

Proton Mail Agent incluye un subsistema de alertas que analiza el contenido de los correos (sin enviarlo a terceros) y emite avisos cuando detecta patrones de riesgo o categorías sensibles.

## Qué detecta

| Categoría | Severidad | Ejemplo de patrón |
|---|---|---|
| `fraud` | critical | Phishing, credenciales solicitadas, premios falsos, dominios suplantadores. |
| `spam` | warning | Ofertas agresivas, "unsubscribe now", palabras de marketing de alto riesgo. |
| `legal` | alert | Abogados, contratos, NDA, tribunales, propiedad intelectual. |
| `admin` | alert | Hacienda, Seguridad Social, registros, certificados digitales. |
| `government` | alert | Ministerios, subvenciones, citas oficiales, DNI/NIE. |
| `banking` | alert | Banca, transferencias, tarjetas, nóminas, facturas. |
| `tech` | info | CI/CD, APIs, incidentes, despliegues, dependencias. |
| `commercial` | info | Ventas, cotizaciones, reuniones, partnership. |
| `personal` | info | Familia, viajes, salud, eventos personales. |

Además, el sistema detecta amenazas específicas:

- `phishing_link` — enlaces a dominios sospechosos o suplantadores.
- `credential_request` — solicitudes de contraseña o verificación de cuenta.
- `urgent_pressure` — lenguaje de urgencia para forzar acciones.
- `suspicious_attachment` — adjuntos con extensiones ejecutables u ofimáticas con macros.

## Configuración

```bash
ALERT_WEBHOOK_URL=https://hooks.example.com/protonsuite-agent
ALERT_MIN_SEVERITY=warning   # info | warning | alert | critical
ALERT_LOG_DIR=logs
ALERTS_ENABLED=true
```

- `ALERT_WEBHOOK_URL` (opcional): recibe un POST JSON por cada alerta que alcance `ALERT_MIN_SEVERITY`.
- `ALERT_LOG_DIR`: directorio donde se escriben `alerts-YYYY-MM-DD.jsonl` y `audit-YYYY-MM-DD.jsonl`.
- `ALERT_MIN_SEVERITY`: filtro de severidad para webhook y fichero; `stderr` refleja todo si `LOG_LEVEL` lo permite.

## Formato del webhook

```json
{
  "severity": "critical",
  "category": "threat",
  "message": "Amenaza phishing_link detectada en UID 42",
  "timestamp": "2026-07-04T07:30:00.000Z",
  "source": "agent/organizer",
  "context": {
    "uid": 42,
    "category": "fraud",
    "threat": "phishing_link",
    "indicators": ["https?://...proton\\.ru"]
  }
}
```

## Privacidad

- No se envían cuerpos de correo completos al webhook, solo metadatos y UIDs.
- El análisis ocurre localmente sobre el texto ya descifrado por Bridge.
- El agente no envía correos a servicios de clasificación externos.

## Integración con clientes MCP

La tool `proton_agent_plan` devuelve el plan de organización y alertas sin aplicar cambios. Un cliente MCP puede llamarla para mostrar alertas al usuario antes de que este ejecute `agent:organize`.
