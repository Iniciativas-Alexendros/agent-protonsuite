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

const RULES: Rule[] = [
  {
    category: "fraud",
    severity: "critical",
    suggestedFolder: "Fraud/Review",
    suggestedLabels: ["phishing", "revisar-urgente"],
    patterns: [
      /\b(click\s+here\s+to\s+verify\s+your\s+account)\b/i,
      /\b(update\s+your\s+payment\s+information)\b/i,
      /\b(suspicious\s+activity\s+detected)\b/i,
      /\b(confirm\s+your\s+identity)\b/i,
      /\b(urgent:\s+account\s+locked)\b/i,
      /\b(won\s+the\s+lottery|claim\s+your\s+prize)\b/i,
      /\b(bitcoin|crypto|wallet\s+seed)\b/i,
      /\b(invoice\s+attached\s+open\s+immediately)\b/i,
      /https?:\/\/[^\s]*proton[^\s]*\.(?:ru|tk|ml|ga|cf|xyz|top)\b/i,
    ],
    weight: 1.0,
  },
  {
    category: "spam",
    severity: "warning",
    suggestedFolder: "Spam",
    suggestedLabels: ["basura"],
    patterns: [
      /\b(unsubscribe\s*now)\b/i,
      /\b(limited\s+time\s+offer)\b/i,
      /\b(act\s+now\s+only)\b/i,
      /\b(miracle|lose\s+weight|earn\s+money\s+fast)\b/i,
      /\b100%\s+free\b/i,
      /\bclick\s+below\s+to\s+get\s+it\b/i,
    ],
    weight: 0.7,
  },
  {
    category: "legal",
    severity: "alert",
    suggestedFolder: "Legal",
    suggestedLabels: ["legal", "conservar"],
    patterns: [
      /\b(lawyer|abogado|bufete|despacho|judicial|juzgado|demanda|demandar)\b/i,
      /\b(contract|contrato|agreement|acuerdo|terms\s+of\s+service)\b/i,
      /\b(nda|non-disclosure|confidencialidad)\b/i,
      /\b(intellectual\s+property|propiedad\s+intelectual)\b/i,
      /\b(court|tribunal|sentencia|resolución|recurso)\b/i,
    ],
    weight: 0.9,
  },
  {
    category: "admin",
    severity: "alert",
    suggestedFolder: "Admin",
    suggestedLabels: ["admin", "conservar"],
    patterns: [
      /\b(hacienda|agencia\s+tributaria|aeat|irpf|iva|declaración)\b/i,
      /\b(seguridad\s+social|tgss|registro\s+mercantil)\b/i,
      /\b(ayuntamiento|municipio|registro|censo|empadronamiento)\b/i,
      /\b(certificado|certificado\s+digital|clave|fnmt|autofirm@|@firma)\b/i,
      /\b(gestoría|gestor|administrativo)\b/i,
    ],
    weight: 0.85,
  },
  {
    category: "government",
    severity: "alert",
    suggestedFolder: "Gobierno",
    suggestedLabels: ["oficial", "conservar"],
    patterns: [
      /\b(gobierno|ministerio|delegación|conselleria|generalitat|junta)\b/i,
      /\b(subvención|ayuda|convocatoria|subsidio|beca)\b/i,
      /\b(procedimiento|expediente|resolución|notificación)\b/i,
      /\b(dni|nie|pasaporte|cita\s+previa)\b/i,
    ],
    weight: 0.85,
  },
  {
    category: "banking",
    severity: "alert",
    suggestedFolder: "Banca",
    suggestedLabels: ["banca", "conservar"],
    patterns: [
      /\b(bank|banco|cuenta|iban|transferencia|ingreso|cargo|recibo)\b/i,
      /\b(tarjeta|compra|pago|paypal|stripe|factura)\b/i,
      /\b(estado\s+de\s+cuenta|extracto|nomina|nómina)\b/i,
      /\b(hipoteca|préstamo|loan|seguro)\b/i,
    ],
    weight: 0.8,
  },
  {
    category: "tech",
    severity: "info",
    suggestedFolder: "Tech",
    suggestedLabels: ["tech", "devops", "conservar"],
    patterns: [
      /\b(git|github|gitlab|ci\/cd|deploy|deployment|build)\b/i,
      /\b(error|incident|alert|monitoring|status\s+page|downtime)\b/i,
      /\b(api|sdk|library|dependency|vulnerability|cve)\b/i,
      /\b(server|database|infra|cloud|aws|gcp|azure)\b/i,
      /\b(pull\s+request|issue|commit|release|version)\b/i,
    ],
    weight: 0.75,
  },
  {
    category: "commercial",
    severity: "info",
    suggestedFolder: "Comercial",
    suggestedLabels: ["comercial"],
    patterns: [
      /\b(sales|ventas|cliente|lead|oportunidad|propuesta)\b/i,
      /\b(cotización|presupuesto|pedido|order|invoice|factura)\b/i,
      /\b(partnership|colaboración|sponsor|patrocinio)\b/i,
      /\b(meeting|reunión|call|demo|presentación)\b/i,
    ],
    weight: 0.7,
  },
  {
    category: "personal",
    severity: "info",
    suggestedFolder: "Personal",
    suggestedLabels: ["personal"],
    patterns: [
      /\b(familia|casa|hogar|reserva|viaje|vuelo|hotel)\b/i,
      /\b(cita\s+médica|medico|salud|receta|ambulatorio)\b/i,
      /\b(feliz\s+cumpleaños|invitación|evento|boda|fiesta)\b/i,
    ],
    weight: 0.6,
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

  if (!best || best.score === 0) {
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

  const checks: Array<{ threat: string; severity: AlertSeverity; patterns: RegExp[] }> = [
    {
      threat: "phishing_link",
      severity: "critical",
      patterns: [
        /https?:\/\/[^\s]+\.(?:ru|tk|ml|ga|cf|xyz|top|click|link|short|bit\.ly|tinyurl)/i,
        /href\s*=\s*"[^"]*proton[^"]*\.(?:ru|tk|ml|ga|cf|xyz|top)"/i,
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
    if (indicators.length > 0) {
      threats.push({
        threat: check.threat,
        severity: check.severity,
        confidence: Math.min(1, indicators.length * 0.5 + 0.4),
        indicators,
      });
    }
  }

  return threats;
}
