import type { AlertSeverity } from "./types.js";

export interface ClassificationResult {
  category: string;
  confidence: number;
  severity: AlertSeverity;
  reason: string;
  suggestedFolder: string;
  suggestedLabels: string[];
}

interface Rule {
  category: string;
  severity: AlertSeverity;
  suggestedFolder: string;
  suggestedLabels: string[];
  patterns: RegExp[];
  weight: number;
}

// -----------------------------------------------------------------------------
// Categorías y carpetas del operador
// -----------------------------------------------------------------------------
// El operador ha definido 5 carpetas de contenido:
//   - Comercial: ofertas, boletines, marketing, ventas, propuestas.
//   - Pagos: facturas (compra/venta), suscripciones, banca, recibos, nóminas.
//   - Logins: alertas automáticas de inicio de sesión, nuevo dispositivo, 2FA.
//   - Avisos: alertas de servicio, incidencias, filtraciones, mantenimiento.
//   - Comunicaciones: escritos/documentos de personas reales o entidades
//     oficiales (administraciones, despachos, organismos del Estado).
// -----------------------------------------------------------------------------
const RULES: Rule[] = [
  {
    category: "logins",
    severity: "info",
    suggestedFolder: "Folders/Logins",
    suggestedLabels: [],
    patterns: [
      /\b(nuevo\s+dispositivo|new\s+device|nueva\s+ubicación|new\s+location)\b/i,
      /\b(inicio\s+de\s+sesión|login|sign-in|signed\s+in|acceso)\b/i,
      /\b(código\s+de\s+verificación|verification\s+code|two-factor|2fa|mfa|autenticación)\b/i,
      /\b(password\s+changed|contraseña\s+cambiada|reset\s+password)\b/i,
      /\b(verify\s+sign-in|confirma\s+tu\s+inicio\s+de\s+sesión)\b/i,
    ],
    weight: 0.9,
  },
  {
    category: "avisos",
    severity: "info",
    suggestedFolder: "Folders/Avisos",
    suggestedLabels: [],
    patterns: [
      /\b(incidencia|service\s+disruption|outage|downtime|mantenimiento|maintenance)\b/i,
      /\b(filtración\s+de\s+datos|data\s+breach|ciberataque|security\s+incident)\b/i,
      /\b(estado\s+del\s+servicio|status\s+page|system\s+status|degraded)\b/i,
      /\b(alerta\s+de\s+seguridad|security\s+alert|unusual\s+activity)\b/i,
      /\b(error\s+detectado|error\s+report|failed\s+payment|pago\s+fallido)\b/i,
    ],
    weight: 0.85,
  },
  {
    category: "comunicaciones",
    severity: "alert",
    suggestedFolder: "Folders/Comunicaciones",
    suggestedLabels: [],
    patterns: [
      /\b(abogado|bufete|despacho|judicial|juzgado|demanda|demandar|tribunal|sentencia|resolución)\b/i,
      /\b(contract|contrato|acuerdo|escrito|documento|notificación|requerimiento)\b/i,
      /\b(hacienda|agencia\s+tributaria|aeat|irpf|iva|declaración|seguridad\s+social|tgss)\b/i,
      /\b(ayuntamiento|municipio|registro\s+mercantil|registro|censo|empadronamiento)\b/i,
      /\b(gobierno|ministerio|delegación|conselleria|generalitat|junta|procedimiento|expediente)\b/i,
      /\b(dni|nie|pasaporte|cita\s+previa|certificado\s+digital|fnmt|autofirm@|@firma)\b/i,
      /\b(gestoría|gestor|administrativo|notaría|notario|registrador)\b/i,
    ],
    weight: 0.85,
  },
  {
    category: "pagos",
    severity: "info",
    suggestedFolder: "Folders/Pagos",
    suggestedLabels: [],
    patterns: [
      /\b(factura|invoice|recibo|receipt|abono|cargo|charge|pago|payment)\b/i,
      /\b(banco|bank|cuenta|iban|transferencia|ingreso|nomina|nómina|salario)\b/i,
      /\b(tarjeta|compra|order|pedido|paypal|stripe|gocardless|revolut)\b/i,
      /\b(estado\s+de\s+cuenta|extracto|suscripción|subscription|renovación|renewal)\b/i,
      /\b(hipoteca|préstamo|loan|seguro|insurance|impuesto|tributo|cuota)\b/i,
    ],
    weight: 0.8,
  },
  {
    category: "comercial",
    severity: "info",
    suggestedFolder: "Folders/Comercial",
    suggestedLabels: [],
    patterns: [
      /\b(oferta|offer|promoción|promotion|descuento|discount|boletín|newsletter)\b/i,
      /\b(sales|ventas|cliente|lead|oportunidad|propuesta|proposal|cotización|presupuesto)\b/i,
      /\b(partnership|colaboración|sponsor|patrocinio|affiliate|afiliado)\b/i,
      /\b(meeting|reunión|call|demo|presentación|webinar)\b/i,
      /\b(marketing|campaign|campaña|email\s+marketing|survey|encuesta)\b/i,
    ],
    weight: 0.75,
  },
];

function normalizeText(input: { from?: string; subject?: string; text?: string; html?: string }): string {
  const parts = [
    input.from ?? "",
    input.subject ?? "",
    input.text ?? "",
    input.html ? input.html.replace(/<[^>]+>/g, " ") : "",
  ];
  return parts.join("\n").toLowerCase();
}

function scoreRule(text: string, rule: Rule): number {
  const matches = rule.patterns.filter((p) => p.test(text)).length;
  if (matches === 0) return 0;
  return Math.min(1, matches * rule.weight);
}

export function classifyEmail(input: { from?: string; subject?: string; text?: string; html?: string }): ClassificationResult {
  const text = normalizeText(input);
  const scores = RULES.map((rule) => ({ rule, score: scoreRule(text, rule) })).sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (best.score === 0) {
    return {
      category: "uncategorized",
      confidence: 0,
      severity: "info",
      reason: "No encaja en ninguna categoría conocida.",
      suggestedFolder: "Archive",
      suggestedLabels: [],
    };
  }

  const runnerUp = scores[1]?.score ?? 0;
  const confidence = best.score - runnerUp;
  const matchedPatterns = best.rule.patterns.filter((p) => p.test(text)).map((p) => p.source);

  return {
    category: best.rule.category,
    confidence: Number(confidence.toFixed(2)),
    severity: best.rule.severity,
    reason: `Coincidencias: ${matchedPatterns.slice(0, 3).join(", ")}`,
    suggestedFolder: best.rule.suggestedFolder,
    suggestedLabels: best.rule.suggestedLabels,
  };
}

export interface ThreatResult {
  threat: string;
  severity: AlertSeverity;
  confidence: number;
  indicators: string[];
}

export function detectThreats(input: { from?: string; subject?: string; text?: string; html?: string }): ThreatResult[] {
  const text = normalizeText(input);
  const threats: ThreatResult[] = [];

  const checks: { threat: string; severity: AlertSeverity; patterns: RegExp[] }[] = [
    {
      threat: "phishing_link",
      severity: "critical",
      patterns: [
        /https?:\/\/[^\s]+\.(?:ru|tk|ml|ga|cf|xyz|top|click|link|short|bit\.ly|tinyurl)/i,
        /href\s*=\s*"[^"]*\.proton\.(?:ru|tk|ml|ga|cf|xyz|top)[^"]*"/i,
      ],
    },
    {
      threat: "credential_request",
      severity: "critical",
      patterns: [
        /\b(enter\s+your\s+password|verify\s+your\s+account|confirm\s+your\s+credentials)\b/i,
        /\b(introduce\s+tu\s+contraseña|verifica\s+tu\s+cuenta)\b/i,
      ],
    },
    {
      threat: "urgent_pressure",
      severity: "warning",
      patterns: [
        /\b(urgent|immediate|action\s+required|hurry|within\s+24\s+hours)\b/i,
        /\b(urgente|inmediato|acción\s+requerida|24\s+horas)\b/i,
      ],
    },
    {
      threat: "suspicious_attachment",
      severity: "alert",
      patterns: [
        /\b(attachment|adjunto):?\s*[^\n]*\.(?:exe|zip|scr|js|vbs|docm|xlsm)\b/i,
      ],
    },
  ];

  for (const check of checks) {
    const indicators = check.patterns.filter((p) => p.test(text)).map((p) => p.source);
    // Requiere al menos 2 indicadores para una amenaza, salvo credential_request
    // que con un solo indicador ya es grave. Esto reduce falsos positivos de
    // regex amplias (phishing_link, urgent_pressure) cuando el operador sube
    // AGENT_MIN_CONFIDENCE a 0.8.
    const minIndicators = check.threat === "credential_request" ? 1 : 2;
    if (indicators.length >= minIndicators) {
      threats.push({
        threat: check.threat,
        severity: check.severity,
        confidence: Math.min(1, indicators.length * 0.4 + 0.4),
        indicators,
      });
    }
  }

  return threats;
}

// -----------------------------------------------------------------------------
// Etiquetas de estado / contexto de interacción del operador
// -----------------------------------------------------------------------------
export interface StateLabelResult {
  labels: string[];
  reason: string;
}

export function inferStateLabels(input: {
  from?: string;
  subject?: string;
  text?: string;
  html?: string;
  category?: string;
}): StateLabelResult {
  const text = normalizeText(input);
  const labels: string[] = [];
  const reasons: string[] = [];

  // Cerrado: consultas/asistencia/casos que ya han sido resueltos o cerrados.
  const closedPatterns = [
    /\b(cerrado|cerrada|resuelto|resuelta|closed|resolved|ticket\s+closed|case\s+closed)\b/i,
    /\b(su\s+(?:consulta|solicitud|caso|ticket|reclamación)\s+(?:ha\s+sido\s+)?(?:resuelta?|cerrada?|atendida?))\b/i,
    /\b(gracias\s+(?:por\s+)?(?:contactar|contactarnos|su\s+paciencia))\b/i,
    /\b(el\s+ticket\s+ha\s+sido\s+(?:resuelto|cerrado))\b/i,
  ];
  if (closedPatterns.some((p) => p.test(text))) {
    labels.push("Labels/Cerrado");
    reasons.push("caso/consulta/asistencia cerrada o resuelta");
  }

  // Por resolver: requiere una acción/respuesta del operador.
  const actionPatterns = [
    /\b(responda|responde|contesta|reply)\b/i,
    /\b(confirme|confirma|confirmar|verifique|verifica|revisar|revise|revisa)\b/i,
    /\b(adjunte|adjunta|adjuntar|envíe|enviar|envia|complete|rellene|firme|firma|pague|paga)\b/i,
    /\b(acción\s+requerida|acción\s+necesaria|requiere\s+su\s+acción|debe\s+actuar)\b/i,
    /\b(haga\s+clic|click\s+here|pulse\s+aquí|descargue|download)\b/i,
  ];
  if (actionPatterns.some((p) => p.test(text))) {
    labels.push("Labels/Por resolver");
    reasons.push("requiere acción o respuesta del operador");
  }

  // Bajo observación: plazo/fecha límite y espera respuesta de terceros.
  const watchPatterns = [
    /\b(antes\s+(?:del|de\s+la)|plazo|vencimiento|fecha\s+límite|deadline|within)\b/i,
    /\b(en\s+(?:24|48|72)\s+(?:horas|h)|próximos\s+días|próximas\s+semanas)\b/i,
    /\b(esperando\s+(?:su|tu)\s+respuesta|le\s+responderemos|le\s+informaremos|pending\s+response)\b/i,
    /\b(su\s+solicitud\s+está\s+en\s+trámite|en\s+proceso|tramitando|bajo\s+revisión)\b/i,
  ];
  if (watchPatterns.some((p) => p.test(text))) {
    labels.push("Labels/Bajo observación");
    reasons.push("plazo o espera de respuesta/acción de terceros");
  }

  // Importante: comunicaciones o pagos con alta relevancia.
  const importantCategories = new Set(["comunicaciones", "pagos"]);
  const importantPatterns = [
    /\b(judicial|juzgado|demanda|demandar|tribunal|sentencia|recurso|apelación|ejecución)\b/i,
    /\b(contrato|acuerdo|nda|confidencialidad|propiedad\s+intelectual|licencia)\b/i,
    /\b(reclamación|reclamar|queja|denuncia|sanción|multa|impago|embargo)\b/i,
    /\b(factura\s+pendiente|pago\s+pendiente|vencido|impago|prórroga|plazo\s+de\s+pago)\b/i,
    /\b(hacienda|aeat|seguridad\s+social|tgss|notificación|procedimiento|expediente)\b/i,
  ];
  if (importantCategories.has(input.category ?? "") && importantPatterns.some((p) => p.test(text))) {
    labels.push("Labels/Importante");
    reasons.push("comunicación o pago de alta relevancia");
  }

  // Ignorado: no se infiere automáticamente; solo el operador lo asigna.

  return {
    labels: Array.from(new Set(labels)),
    reason: reasons.join("; ") || "sin etiqueta de estado inferida",
  };
}
