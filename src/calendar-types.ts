/**
 * Tipos para CalDAV / iCalendar (RFC 5545).
 * Cubren el subconjunto necesario para Proton Calendar MVP.
 * Mantenidos en archivo separado para que server/calendar.ts y src/calendar.ts
 * compartan los mismos tipos sin acoplamiento cruzado.
 */

// ---------------------------------------------------------------------------
// Calendar info — metadatos de un calendario remoto
// ---------------------------------------------------------------------------

export interface CalendarInfo {
  url: string;
  displayName?: string;
  color?: string;
  description?: string;
  /** CTag / sync-token para detección de cambios incremental */
  syncToken?: string;
  /** Componentes VCalendar soportados (VEVENT, VTODO, VJOURNAL) */
  supportedComponents?: string[];
}

// ---------------------------------------------------------------------------
// Event — un evento de calendario (VEVENT)
// ---------------------------------------------------------------------------

export interface CalEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  /** RFC 5545 status: TENTATIVE, CONFIRMED, CANCELLED */
  status?: 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED';
  /** Clasificación: PUBLIC, PRIVATE, CONFIDENTIAL */
  classification?: 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL';
  /** Zona horaria del evento (IANA, ej. "Europe/Madrid") */
  timezone?: string;
  /** Si es un evento de día completo (sin hora) */
  isAllDay?: boolean;
  /** Transparencia: OPAQUE (ocupa tiempo) / TRANSPARENT (no bloquea) */
  transparency?: 'OPAQUE' | 'TRANSPARENT';
  /** Prioridad 0-9 (0=sin definir, 1=máxima, 9=mínima) */
  priority?: number;
  /** Categorías / tags del evento */
  categories?: string[];
  /** Regla de recurrencia (RRULE) */
  recurrence?: RecurrenceRule;
  /** IDs de eventos excepcionales en una serie recurrente */
  recurrenceExceptions?: string[];
  /** Fecha/hora original para un cambio en un evento recurrente */
  recurrenceId?: Date;
  /** Adjuntos (ATTACH) */
  attachments?: Attachment[];
  /** Alarmas (VALARM) */
  alarms?: Alarm[];
  /** Asistentes (ATTENDEE) */
  attendee?: Attendee[];
  /** URL asociada al evento */
  url?: string;
  /** Fechas de creación y última modificación */
  created?: Date;
  lastModified?: Date;
  /** Secuencia de revisión (para gestión de conflictos CalDAV) */
  sequence?: number;
  /** Duración (alternativa a end, RFC 5545 3.8.2.5) */
  duration?: string;
}

// ---------------------------------------------------------------------------
// Recurrence rule (RRULE) — RFC 5545 3.8.5.3
// ---------------------------------------------------------------------------

export interface RecurrenceRule {
  freq: 'SECONDLY' | 'MINUTELY' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  count?: number;
  until?: Date;
  bySecond?: number[];
  byMinute?: number[];
  byHour?: number[];
  byDay?: string[];        // "MO", "TU", "+1MO", "-1FR", etc.
  byMonthDay?: number[];
  byYearDay?: number[];
  byWeekNo?: number[];
  byMonth?: number[];
  bySetPos?: number[];
  /** Día de inicio de la semana (MO=Monday, SU=Sunday) */
  wkst?: string;
}

// ---------------------------------------------------------------------------
// Alarm (VALARM) — RFC 5545 3.6.6
// ---------------------------------------------------------------------------

export interface Alarm {
  action: 'AUDIO' | 'DISPLAY' | 'EMAIL';
  /** Trigger relativo: "-PT15M" = 15 minutos antes */
  trigger: string;
  duration?: string;
  repeat?: number;
  /** Solo para ACTION=EMAIL */
  attendees?: Attendee[];
  summary?: string;
  description?: string;
  /** Solo para ACTION=AUDIO */
  attach?: Attachment;
}

// ---------------------------------------------------------------------------
// Attendee (ATTENDEE) — RFC 5545 3.8.4.1
// ---------------------------------------------------------------------------

export interface Attendee {
  uri: string;
  cn?: string;
  role?: 'CHAIR' | 'REQ-PARTICIPANT' | 'OPT-PARTICIPANT' | 'NON-PARTICIPANT';
  partstat?: 'NEEDS-ACTION' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'DELEGATED';
  rsvp?: boolean;
  delegatedFrom?: string;
  delegatedTo?: string;
  /** Miembro de un grupo (MEMBER) */
  member?: string;
  /** Lenguaje preferido del asistente */
  language?: string;
}

// ---------------------------------------------------------------------------
// Attachment (ATTACH)
// ---------------------------------------------------------------------------

export interface Attachment {
  /** URI (enlace) o base64 embebido */
  uri: string;
  /** MIME type, ej. "text/calendar", "image/png" */
  formatType?: string;
  /** Nombre del fichero */
  filename?: string;
  /** Tamaño en bytes */
  size?: number;
  /** Content ID para referencias internas (CID:) */
  contentId?: string;
}

// ---------------------------------------------------------------------------
// Free/busy (VFREEBUSY)
// ---------------------------------------------------------------------------

export interface FreeBusyEntry {
  type: 'FREE' | 'BUSY' | 'BUSY-UNAVAILABLE' | 'BUSY-TENTATIVE';
  start: Date;
  end: Date;
  uid?: string;
  summary?: string;
}

// ---------------------------------------------------------------------------
// CalDAV response types
// ---------------------------------------------------------------------------

export interface CalDavMultistatus {
  /** DAV: href de la colección */
  href: string;
  /** Propiedades DAV solicitadas */
  properties: Record<string, unknown>;
  /** Recursos hijos (calendar objects) */
  resources?: CalDavResource[];
}

export interface CalDavResource {
  href: string;
  /** ETag para concurrencia */
  getetag?: string;
  /** Content-Type del recurso */
  getcontenttype?: string;
  /** Tamaño */
  getcontentlength?: number;
  /** Fecha de modificación */
  getlastmodified?: string;
  /** Datos del recurso (text/calendar o text/vcard) */
  data?: string;
  /** Estado de la operación PROPFIND */
  status?: string;
}
