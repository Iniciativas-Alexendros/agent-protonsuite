---
name: reply-organize
description: Responde a un correo de Proton Mail y, opcionalmente, lo archiva en una carpeta. Preserva el hilo y nunca borra. Puede usar proton_agent_plan para obtener contexto de organización.
---

# Responder y organizar

## Objetivo

Ayudar al operador a responder un correo y, si lo solicita, moverlo a una carpeta de archivo o seguimiento.

## Precondiciones

1. `proton_list_folders` ejecutado para conocer la taxonomía.
2. Se dispone del UID del correo a responder.

## Flujo

1. **Buscar** el correo:
   - `proton_search_emails` con `unseen_only=true` y `mailbox=INBOX`, o
   - `proton_list_emails` si el operador no especifica filtros.
2. **Leer** el mensaje completo: `proton_get_email` con `response_format=markdown` (o `json` si se va a consumir por un backend).
3. **Proponer borrador** de respuesta al operador. No enviar sin confirmación.
4. Si el operador confirma:
   - `proton_reply_email` con `include_quote=true` (default) para mantener el hilo.
   - Opcionalmente `proton_flag_email` con `action=read`.
5. Si el operador pide archivar:
   - `proton_move_email` desde `INBOX` al destino indicado (ej. `Folders/Hecho` o `Folders/Seguimiento`).
6. **Verificar:**
   - `proton_mailbox_status` en origen y destino si se movió.
   - Confirmar que el correo enviado aparece en `Sent` (vía `proton_search_emails` en `Sent` si es necesario).

## Reglas

- Si no hay `reply_to` ni `from` en el original, informar al operador y no enviar.
- Si el operador pide `reply_all`, usa `reply_all=true` en `proton_reply_email`.
- Nunca uses `proton_delete_email` en este flujo.
- Si el mensaje tiene adjuntos relevantes y el operador los necesita, usa `proton_get_attachment`.

## Tools MCP usadas

`proton_list_folders` · `proton_search_emails` · `proton_list_emails` · `proton_get_email` · `proton_reply_email` · `proton_flag_email` · `proton_move_email`.
