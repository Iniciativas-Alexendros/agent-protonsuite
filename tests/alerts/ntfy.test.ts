/**
 * Tests para src/alerts/ntfy.ts (3.70% → objetivo 100%).
 *
 * NtfyAlertSink.emit construye un POST a `${url}/${topic}` con:
 *  - Headers: Content-Type: text/plain + opcional Authorization: Bearer <token>
 *  - Body: formato multilínea con severity, category, message, source, context
 *
 * Mock: vi.stubGlobal('fetch', mockFetch) — fetch es global en Node 18+
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NtfyAlertSink } from '../../src/alerts/ntfy.js'
import type { AlertEvent } from '../../src/alerts/types.js'

// ---------------------------------------------------------------------------
// Mock fetch global
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeEvent(overrides?: Partial<AlertEvent>): AlertEvent {
  return {
    severity: 'warning',
    category: 'Security',
    message: 'Suspicious login detected',
    timestamp: '2026-07-18T10:00:00Z',
    source: 'proton-bridge',
    ...overrides,
  }
}

// ===========================================================================
// NtfyAlertSink.emit
// ===========================================================================

describe('NtfyAlertSink.emit', () => {
  const defaultUrl = 'https://ntfy.sh'
  const defaultTopic = 'alerts'

  it('POST a url/topic sin token, sin Authorization header', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const sink = new NtfyAlertSink(defaultUrl, defaultTopic)

    await sink.emit(makeEvent())

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://ntfy.sh/alerts')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('text/plain')
    expect(opts.headers.Authorization).toBeUndefined()
  })

  it('incluye Authorization: Bearer <token> cuando se proporciona token', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const sink = new NtfyAlertSink(defaultUrl, defaultTopic, 'tk_abc123')

    await sink.emit(makeEvent())

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers.Authorization).toBe('Bearer tk_abc123')
  })

  it('body contiene severity uppercase, category, message, source', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const sink = new NtfyAlertSink(defaultUrl, defaultTopic)

    await sink.emit(makeEvent({ severity: 'critical', category: 'Intrusion', message: 'Multiple failed logins' }))

    const [, opts] = mockFetch.mock.calls[0]
    const body = opts.body as string
    expect(body).toContain('[CRITICAL] Intrusion')
    expect(body).toContain('Multiple failed logins')
    expect(body).toContain('Source: proton-bridge')
  })

  it('incluye línea Context: cuando event.context está definido', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const sink = new NtfyAlertSink(defaultUrl, defaultTopic)

    await sink.emit(makeEvent({
      context: { ip: '192.168.1.1', attempts: 5 },
    }))

    const [, opts] = mockFetch.mock.calls[0]
    const body = opts.body as string
    expect(body).toContain('Context: ')
    expect(body).toContain('"ip":"192.168.1.1"')
  })

  it('no incluye línea Context: cuando event.context es undefined', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const sink = new NtfyAlertSink(defaultUrl, defaultTopic)

    await sink.emit(makeEvent({ context: undefined }))

    const [, opts] = mockFetch.mock.calls[0]
    const body = opts.body as string
    expect(body).not.toContain('Context:')
  })

  it('lanza Error con status cuando respuesta no es ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' })
    const sink = new NtfyAlertSink(defaultUrl, defaultTopic)

    await expect(sink.emit(makeEvent())).rejects.toThrow('ntfy 401 Unauthorized')
  })

  it('resuelve sin error cuando respuesta es ok', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const sink = new NtfyAlertSink(defaultUrl, defaultTopic)

    await expect(sink.emit(makeEvent())).resolves.toBeUndefined()
  })
})
