/**
 * Tests para src/alerts/webhook.ts (7.69% → objetivo 100%).
 *
 * WebhookAlertSink.emit hace un POST a la URL configurada con:
 *  - Content-Type: application/json
 *  - body: JSON.stringify(event)
 *  - Error si !res.ok
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AlertEvent } from '../../src/alerts/types.js'
import { WebhookAlertSink } from '../../src/alerts/webhook.js'

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
    severity: 'critical',
    category: 'System',
    message: 'Disk usage at 95%',
    timestamp: '2026-07-18T12:00:00Z',
    source: 'monitor',
    ...overrides,
  }
}

// ===========================================================================
// WebhookAlertSink.emit
// ===========================================================================

describe('WebhookAlertSink.emit', () => {
  const webhookUrl = 'https://hooks.example.com/alerts'

  it('POST a la URL configurada con Content-Type application/json', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const sink = new WebhookAlertSink(webhookUrl)

    await sink.emit(makeEvent())

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe(webhookUrl)
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
  })

  it('body es JSON.stringify(event) con todos los campos', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const sink = new WebhookAlertSink(webhookUrl)

    const event = makeEvent({ context: { host: 'server01' } })
    await sink.emit(event)

    const [, opts] = mockFetch.mock.calls[0]
    const parsed = JSON.parse(opts.body as string)
    expect(parsed).toEqual(event)
  })

  it('lanza Error con status cuando respuesta no es ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' })
    const sink = new WebhookAlertSink(webhookUrl)

    await expect(sink.emit(makeEvent())).rejects.toThrow('webhook 500 Internal Server Error')
  })

  it('resuelve sin error cuando respuesta es ok', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const sink = new WebhookAlertSink(webhookUrl)

    await expect(sink.emit(makeEvent())).resolves.toBeUndefined()
  })
})
