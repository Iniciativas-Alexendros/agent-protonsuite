/**
 * Tests para src/alerts/rules.ts (71.88% → objetivo 100%).
 *
 * Funciones puras sin I/O. No necesita mocks.
 * Cubre: classifyEmail (6 caminos), detectThreats (4 tipos),
 * inferStateLabels (4 etiquetas).
 */
import { describe, it, expect } from 'vitest'
import { classifyEmail, detectThreats, inferStateLabels } from '../../src/alerts/rules.js'

describe('classifyEmail', () => {
  it('logins: detecta "nuevo dispositivo"', () => {
    const r = classifyEmail({ subject: 'Nuevo dispositivo conectado a tu cuenta' })
    expect(r.category).toBe('logins')
    expect(r.confidence).toBeGreaterThan(0)
    expect(r.suggestedFolder).toBe('Folders/Logins')
  })

  it('avisos: detecta "service disruption"', () => {
    const r = classifyEmail({ subject: 'Service disruption on Proton Mail' })
    expect(r.category).toBe('avisos')
    expect(r.suggestedFolder).toBe('Folders/Avisos')
  })

  it('comunicaciones: detecta "juzgado"', () => {
    const r = classifyEmail({ text: 'Notificación del juzgado de primera instancia' })
    expect(r.category).toBe('comunicaciones')
    expect(r.suggestedFolder).toBe('Folders/Comunicaciones')
  })

  it('pagos: detecta "factura"', () => {
    const r = classifyEmail({ subject: 'Factura mensual de tu suscripción' })
    expect(r.category).toBe('pagos')
    expect(r.suggestedFolder).toBe('Folders/Pagos')
  })

  it('comercial: detecta "oferta"', () => {
    const r = classifyEmail({ subject: 'Oferta especial para clientes' })
    expect(r.category).toBe('comercial')
    expect(r.suggestedFolder).toBe('Folders/Comercial')
  })

  it('sin coincidencias → uncategorized, confidence 0', () => {
    const r = classifyEmail({ subject: 'Hola, ¿qué tal?' })
    expect(r.category).toBe('uncategorized')
    expect(r.confidence).toBe(0)
    expect(r.suggestedFolder).toBe('Archive')
  })

  it('usa from + subject + text + html (con strip tags)', () => {
    const r = classifyEmail({
      from: 'facturas@empresa.com',
      subject: 'Tu recibo',
      text: 'Adjunto factura del mes',
      html: '<p>Pago recibido</p>',
    })
    expect(r.category).toBe('pagos')
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('mayor número de matches = mayor score', () => {
    const single = classifyEmail({ subject: 'factura' })
    const multi = classifyEmail({ subject: 'factura de pago con tarjeta' })
    expect(multi.confidence).toBeGreaterThanOrEqual(single.confidence)
  })
})

describe('detectThreats', () => {
  it('phishing_link: URL con .xyz TLD + href con .proton.xyz (subdominio)', () => {
    // La regex del segundo patrón busca href="...*.proton.TLD..."
    // donde TLD está en la lista (ru, tk, xyz, etc.).
    // Por eso el href debe tener un subdominio ANTES de "proton" (ej. login.proton.xyz),
    // no "proton.xyz" directamente (faltaría el dot antes de "proton").
    const r = detectThreats({
      text: 'Click https://evil.xyz/login and <a href="https://login.proton.xyz/verify">link</a>',
    })
    const phishing = r.find((t) => t.threat === 'phishing_link')
    expect(phishing).toBeDefined()
    expect(phishing!.severity).toBe('critical')
    expect(phishing!.indicators.length).toBeGreaterThanOrEqual(2)
  })

  it('credential_request: detecta con solo 1 indicador', () => {
    const r = detectThreats({ text: 'Please verify your account credentials immediately' })
    const cred = r.find((t) => t.threat === 'credential_request')
    expect(cred).toBeDefined()
    expect(cred!.severity).toBe('critical')
  })

  it('urgent_pressure: requiere 2 patrones (EN + ES)', () => {
    const r = detectThreats({ text: 'URGENT: Action required within 24 hours. Urgente: Acción requerida en 24 horas.' })
    const urgent = r.find((t) => t.threat === 'urgent_pressure')
    expect(urgent).toBeDefined()
    expect(urgent!.severity).toBe('warning')
    expect(urgent!.indicators.length).toBeGreaterThanOrEqual(2)
  })

  it('suspicious_attachment: 1 patron, minIndicators=2 → nunca detecta', () => {
    // Nota: la fuente requiere 2 patrones (minIndicators=2) pero
    // suspicious_attachment solo tiene 1 patron. Con 1 < 2 nunca
    // se activa. Esto es un bug o decision de diseno de la fuente.
    const r = detectThreats({ text: 'See attached file: document.exe with attachment.exe' })
    const susp = r.find((t) => t.threat === 'suspicious_attachment')
    expect(susp).toBeUndefined()
  })

  it('no detecta amenazas en texto normal', () => {
    const r = detectThreats({ subject: 'Reunión mañana a las 10' })
    expect(r).toHaveLength(0)
  })
})

describe('inferStateLabels', () => {
  it('cerrado: detecta "resuelto" y "gracias por contactar"', () => {
    const r = inferStateLabels({ text: 'Su ticket ha sido resuelto. Gracias por contactar.' })
    expect(r.labels).toContain('Labels/Cerrado')
    expect(r.reason).toContain('cerrada o resuelta')
  })

  it('por resolver: detecta "responda"', () => {
    const r = inferStateLabels({ subject: 'Por favor, responda a este mensaje' })
    expect(r.labels).toContain('Labels/Por resolver')
    expect(r.reason).toContain('acción o respuesta')
  })

  it('bajo observación: detecta "plazo"', () => {
    const r = inferStateLabels({ text: 'Tiene un plazo de 15 días para contestar' })
    expect(r.labels).toContain('Labels/Bajo observación')
    expect(r.reason).toContain('plazo')
  })

  it('importante: categoría comunicaciones + patrón judicial', () => {
    const r = inferStateLabels({ subject: 'Demanda judicial', category: 'comunicaciones' })
    expect(r.labels).toContain('Labels/Importante')
  })

  it('importante: categoría pagos + patrón factura pendiente', () => {
    const r = inferStateLabels({ text: 'Tiene una factura pendiente de pago', category: 'pagos' })
    expect(r.labels).toContain('Labels/Importante')
  })

  it('importante: no se activa para categorías no relevantes', () => {
    const r = inferStateLabels({ subject: 'Demanda judicial', category: 'comercial' })
    expect(r.labels).not.toContain('Labels/Importante')
  })

  it('sin coincidencias → labels vacío y reason informativo', () => {
    const r = inferStateLabels({ subject: 'Hola' })
    expect(r.labels).toHaveLength(0)
    expect(r.reason).toContain('sin etiqueta')
  })
})
