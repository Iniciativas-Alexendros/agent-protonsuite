---
name: organize-inbox
description: Organiza el INBOX de Proton Mail en carpetas profesionales y etiquetas, siempre en dry-run primero.
---

# Organize inbox — Organización y archivado del buzón

Objetivo: clasificar los correos almacenados en INBOX y proponer/crear una estructura de carpetas y etiquetas acorde a categorías profesionales.

## Reglas de ejecución

1. **Siempre dry-run primero.** `AGENT_DRY_RUN=true` es el default.
2. **Nunca borrar** en este playbook; solo mover y etiquetar.
3. **Respetar correos ya archivados:** no tocar carpetas fuera de INBOX salvo para mover destino.
4. **Confirmar** antes de aplicar cambios reales.

## Categorías objetivo

| Categoría | Carpeta | Cuándo mover |
|---|---|---|
| Legal | `Legal` | Contratos, NDA, abogados, tribunales, propiedad intelectual. |
| Admin | `Admin` | Hacienda, Seguridad Social, certificados, gestorías. |
| Gobierno | `Gobierno` | Ministerios, subvenciones, citas oficiales. |
| Banca | `Banca` | Banca, pagos, facturas, nóminas, seguros. |
| Tech | `Tech` | CI/CD, incidentes, APIs, dependencias, despliegues. |
| Comercial | `Comercial` | Ventas, cotizaciones, clientes, partnerships. |
| Personal | `Personal` | Familia, viajes, salud, eventos. |
| Spam | `Spam` | Correos no deseados comerciales. |
| Fraud/Review | `Fraud/Review` | Phishing, amenazas detectadas, revisión manual. |
| Uncategorized | `Archive` | Correos que no encajan en ninguna categoría. |

## Comandos

```bash
# Plan en dry-run (default)
npx -y @alexendros/protonmail-agent organize

# Aplicar tras validación
AGENT_DRY_RUN=false npx -y @alexendros/protonmail-agent organize

# Limitar correos analizados (útil para buzones grandes)
AGENT_MAX_INSPECT_EMAILS=500 npx -y @alexendros/protonmail-agent organize
```

## Salida

El agente imprime y registra en `logs/alerts-YYYY-MM-DD.jsonl`:

- Carpetas a crear.
- UIDs a mover y su destino.
- Etiquetas sugeridas.
- Alertas de seguridad por contenido.

## Reversión

Si se aplicaron cambios no deseados, los correos movidos pueden devolverse a INBOX con `proton_move_email` desde un cliente MCP o, preferiblemente, restaurando desde el plan guardado en el log de auditoría.
