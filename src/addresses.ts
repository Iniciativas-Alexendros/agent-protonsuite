/**
 * Parsing y normalización de direcciones de correo, consolidado.
 *
 * Antes la lógica estaba duplicada entre `imap.ts` (envelopes de imapflow +
 * `ParsedMail` de mailparser) y `smtp.ts` (matching de direcciones para
 * threading). Un cambio en el formato `Nombre <email>` obligaba a tocar dos
 * sitios. Aquí vive una sola vez; imap.ts y smtp.ts importan de este módulo.
 */
import type { ParsedMail } from 'mailparser'

/** Forma de dirección tal como la entrega el `envelope` de imapflow. */
export interface EnvelopeAddress {
  name?: string
  address?: string
  mailbox?: string
  host?: string
}

/** Una dirección de envelope → `"Nombre <email>"` o `"email"`, o undefined si no hay email. */
export function envelopeAddrToString(a: EnvelopeAddress): string | undefined {
  const email =
    a.address ?? (a.mailbox && a.host ? `${a.mailbox}@${a.host}` : undefined)
  if (!email) return undefined
  return a.name ? `${a.name} <${email}>` : email
}

/** Lista de envelope → string `"a, b, c"` (o undefined si vacía). */
export function addrListToString(
  list: EnvelopeAddress[] | undefined,
): string | undefined {
  if (!list || list.length === 0) return undefined
  return list.map(envelopeAddrToString).filter(Boolean).join(', ')
}

/** Lista de envelope → array de strings legibles. */
export function addrListToArray(list: EnvelopeAddress[] | undefined): string[] {
  if (!list) return []
  return list.map(envelopeAddrToString).filter((s): s is string => !!s)
}

/** Campo de direcciones de `mailparser` (to/cc/bcc/replyTo) → array de strings legibles. */
export function addressesToArray(
  field: ParsedMail['to'] | ParsedMail['replyTo'],
): string[] {
  if (!field) return []
  const list = Array.isArray(field) ? field : [field]
  const out: string[] = []
  for (const item of list) {
    for (const v of item.value) {
      if (v.address) out.push(v.name ? `${v.name} <${v.address}>` : v.address)
    }
  }
  return out
}

/** Extrae el email puro de un `"Nombre <email>"` (o devuelve la entrada tal cual). */
export function extractEmail(s: string): string {
  const m = /<([^>]+)>/.exec(s)
  return (m?.[1] ?? s).trim()
}

/** ¿La dirección `addr` (en cualquier forma) corresponde al email `target`? Case-insensitive. */
export function addrMatches(addr: string, target: string): boolean {
  const m = /<([^>]+)>/.exec(addr)
  const email = (m?.[1] ?? addr).toLowerCase().trim()
  return email === target.toLowerCase().trim()
}
