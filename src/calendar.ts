/**
 * CalDAV client for Proton Calendar.
 * Activated when PROTON_CALENDAR_CALDAV_URL is set.
 */
import { DAVClient } from 'tsdav'
import type { CalendarInfo, CalEvent } from './calendar-types.js'

export type { CalendarInfo, CalEvent } from './calendar-types.js'

export class CalendarClient {
  constructor(
    private opts: { serverUrl: string; username: string; password: string },
  ) {}

  private createClient() {
    return new DAVClient({
      serverUrl: this.opts.serverUrl,
      credentials: {
        username: this.opts.username,
        password: this.opts.password,
      },
    })
  }

  async listCalendars(): Promise<CalendarInfo[]> {
    const client = this.createClient()
    await client.login()
    const cals: unknown = await client.fetchCalendars()
    return (cals as Record<string, unknown>[]).map((c) => ({
      url: typeof c.url === 'string' ? c.url : '',
      displayName:
        typeof c.displayName === 'string' ? c.displayName : undefined,
    }))
  }

  async listEvents(
    calendarUrl: string,
    from: Date,
    to: Date,
  ): Promise<CalEvent[]> {
    const client = this.createClient()
    await client.login()
    const events: unknown = await client.fetchCalendarObjects({
      calendar: { url: calendarUrl },
      timeRange: { start: from.toISOString(), end: to.toISOString() },
    })
    return (events as Record<string, unknown>[]).map((e) => {
      const data = typeof e.data === 'string' ? e.data : ''
      return {
        uid: typeof e.uid === 'string' ? e.uid : '',
        summary: /SUMMARY:([^\r\n]+)/.exec(data)?.[1] ?? '',
        start: new Date(/DTSTART[^:]*:([^\r\n]+)/.exec(data)?.[1] ?? ''),
        end: new Date(/DTEND[^:]*:([^\r\n]+)/.exec(data)?.[1] ?? ''),
        location: /LOCATION:([^\r\n]+)/.exec(data)?.[1],
        description: /DESCRIPTION:([^\r\n]+)/.exec(data)?.[1],
      }
    })
  }

  async createEvent(
    calendarUrl: string,
    event: {
      summary: string
      start: Date
      end: Date
      location?: string
      description?: string
    },
  ): Promise<CalEvent> {
    const client = this.createClient()
    await client.login()
    const ics =
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        `DTSTART:${formatIcs(event.start)}`,
        `DTEND:${formatIcs(event.end)}`,
        `SUMMARY:${event.summary}`,
        event.location ? `LOCATION:${event.location}` : '',
        event.description ? `DESCRIPTION:${event.description}` : '',
        'END:VEVENT',
        'END:VCALENDAR',
      ]
        .filter(Boolean)
        .join('\r\n') + '\r\n'
    void (await client.createCalendarObject({
      calendar: { url: calendarUrl },
      filename: `${event.start.toISOString()}-${event.summary.replace(/\s+/g, '-')}.ics`,
      iCalString: ics,
    }))
    return {
      uid: '',
      summary: event.summary,
      start: event.start,
      end: event.end,
      location: event.location,
      description: event.description,
    }
  }
}

function formatIcs(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}
