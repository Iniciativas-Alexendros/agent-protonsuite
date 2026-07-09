/**
 * Registro de las 13 MCP tools sobre un `McpServer`.
 *
 * Convenciones aplicadas a TODAS las tools:
 *  - **`inputSchema` con Zod**: el SDK convierte el schema Zod a JSON Schema
 *    draft-07 y lo expone en `tools/list`. El modelo ve tipos, descripciones
 *    y defaults — puede construir llamadas válidas sin adivinar.
 *  - **`annotations`**: cada tool declara al menos `readOnlyHint` y
 *    `openWorldHint`. Las mutativas añaden `destructiveHint` o
 *    `idempotentHint`. Esto permite al cliente MCP (y al humano que lo audita)
 *    razonar sobre efectos sin leer el handler.
 *  - **`response_format: "markdown" | "json"`** en las tools de lectura. Por
 *    defecto markdown — más natural para el modelo al resumir. JSON cuando
 *    el consumidor es un backend (ver `fetchUnreadSummary` en el Command
 *    Center).
 *
 * Instrucciones del servidor: el `instructions` que se pasa al constructor es
 * contexto que el modelo VE al listar tools. Por eso recordamos la necesidad
 * de llamar primero a `proton_list_folders` y de usar UIDs (no seq numbers).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SearchObject } from "imapflow";
import { z } from "zod";
import { buildOrganizationPlan, parseGoal, buildGoalContext } from "./agent/index.js";
import { AlertSystem } from "./alerts/index.js";
import type { Config } from "./config.js";
import { ImapClient } from "./imap.js";
import { PassClient } from "./pass.js";
import { SmtpClient, buildForwardOptions, buildReplyOptions } from "./smtp.js";
import { VERSION } from "./version.js";

type Logger = ReturnType<typeof import("./config.js").createLogger>;

// -----------------------------------------------------------------------------
// Output schemas (structuredContent) — compatible MCP SDK >=1.x
//
// Cada read-only tool devuelve `structuredContent` además del texto humano,
// permitiendo a clientes modernos consumir tipos sin reparsing del markdown.
// -----------------------------------------------------------------------------
const mailboxSchema = z.object({
  path: z.string(),
  name: z.string(),
  specialUse: z.string().nullish(),
  flags: z.array(z.string()),
  delimiter: z.string().nullable().optional(),
  subscribed: z.boolean().optional(),
});

const folderListSchema = { folders: z.array(mailboxSchema) };

const mailboxStatusSchema = {
  mailbox: z.string(),
  messages: z.number().int(),
  unseen: z.number().int(),
  recent: z.number().int(),
  uidNext: z.number().int().optional(),
};

const emailHeaderSchema = z.object({
  uid: z.number().int(),
  from: z.string().optional(),
  to: z.array(z.string()).optional(),
  subject: z.string().optional(),
  date: z.string().optional(),
  flags: z.array(z.string()),
  size: z.number().int().optional(),
});

const emailListSchema = {
  mailbox: z.string(),
  total: z.number().int(),
  count: z.number().int(),
  offset: z.number().int(),
  has_more: z.boolean(),
  next_offset: z.number().int().optional(),
  items: z.array(emailHeaderSchema),
};

const emailSearchSchema = {
  mailbox: z.string(),
  matched: z.number().int(),
  count: z.number().int(),
  has_more: z.boolean(),
  items: z.array(emailHeaderSchema),
};

const emailFullSchema = {
  uid: z.number().int(),
  from: z.string().optional(),
  to: z.array(z.string()),
  cc: z.array(z.string()),
  subject: z.string().optional(),
  date: z.string().optional(),
  flags: z.array(z.string()),
  textBody: z.string().optional(),
  htmlBody: z.string().optional(),
  attachments: z.array(
    z.object({
      filename: z.string().optional(),
      contentType: z.string(),
      size: z.number().int(),
    }),
  ),
};

const attachmentSchema = {
  filename: z.string().optional(),
  contentType: z.string(),
  size_bytes: z.number().int(),
  returned_bytes: z.number().int(),
  truncated: z.boolean(),
  base64: z.string(),
};

export function buildServer(
  cfg: Config,
  log: Logger,
): { server: McpServer; imap: ImapClient; smtp: SmtpClient } {
  const bridgeCfg = cfg.products.mail.bridge;
  let passwordResolver: () => Promise<string>;
  if (cfg.products.pass.enabled && bridgeCfg.passPath) {
    const passClient = new PassClient({ storeDir: cfg.products.pass.storeDir }, log);
    passwordResolver = () => passClient.get(bridgeCfg.passPath!);
  } else {
    passwordResolver = () => Promise.resolve(bridgeCfg.pass);
  }
  const resolvedBridgeCfg = { ...bridgeCfg, passwordResolver };

  const imap = new ImapClient(resolvedBridgeCfg, log);
  const smtp = new SmtpClient(resolvedBridgeCfg, log);

  const server = new McpServer(
    { name: "protonsuite-agent", version: VERSION },
    {
      instructions:
        "Proton Suite agent with multiple products. Mail: via Proton Mail Bridge (IMAP/SMTP) — call proton_list_folders first, use UIDs. Pass: via pass-cli — never returns secret values, only confirms found/generated. Calendar and Drive tools available as stubs until backend support is ready. Before any write operation, review the plan in read-only mode.",
    },
  );

  // Wrapper de registro con traza por handler. `register` comparte la firma
  // (sobrecargada y genérica) de `server.registerTool`, así que cada call-site
  // conserva el tipado de `args` inferido desde su inputSchema; el casting a
  // `any` queda confinado aquí. Emite un `debug` con { tool, ms } al terminar
  // (éxito o error) — sin volcar args, que pueden traer cuerpos o direcciones.
  const register: typeof server.registerTool = ((name, config, cb) =>
    server.registerTool(
      name,
      config as never,
      (async (...callArgs: unknown[]) => {
        const startedAt = Date.now();
        try {
          return await (cb as (...a: unknown[]) => Promise<unknown>)(...callArgs);
        } finally {
          log.debug("tool", { tool: name, ms: Date.now() - startedAt });
        }
      }) as never,
    )) as typeof server.registerTool;

  /**
   * Resuelve el buzón de Trash. Si el caller no pasa `override`, busca el
   * mailbox con special-use `\Trash` (IMAP) en vez de asumir el literal
   * inglés "Trash" — que falla en cuentas con la papelera en otro idioma
   * (Papelera, Corbeille…). Fallback a "Trash" si no hay match.
   */
  async function resolveTrashPath(override?: string): Promise<string> {
    if (override) return override;
    const mbs = await imap.listMailboxes();
    const trash = mbs.find((m) => m.specialUse === "\\Trash");
    return trash?.path ?? "Trash";
  }

  // ---------------------------------------------------------------------------
  // Registro de las 13 tools agrupado por dominio funcional. Cada helper
  // encapsula el register de su grupo; los handlers capturan `imap`/`smtp` por
  // closure, así que el cuerpo de `buildServer` solo orquesta.
  // ---------------------------------------------------------------------------
  const alerts = new AlertSystem(cfg.alerts, log);

  registerFolderTools();
  registerListSearchTools();
  registerReadTools();
  registerSendTools();
  registerModifyTools();
  registerAgentTools();

  registerPassTools();
  registerCalendarTools();
  registerDriveTools();
  registerSuiteTool();

  return { server, imap, smtp };

  // ---------------------------------------------------------------------------
  // Folders
  // ---------------------------------------------------------------------------
  function registerFolderTools() {
    register(
      "proton_list_folders",
      {
        title: "List mailboxes (folders/labels)",
        description:
          "Lists every IMAP mailbox exposed by Proton Bridge (system folders like INBOX/Sent/Trash and user labels/folders). Use the returned 'path' values as the mailbox argument in other tools. Call this first when the agent doesn't know the mailbox layout.",
        inputSchema: {
          response_format: z
            .enum(["markdown", "json"])
            .default("markdown")
            .describe("Output format"),
        },
        outputSchema: folderListSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
          idempotentHint: true,
        },
      },
      async ({ response_format }) => {
        const mbs = await imap.listMailboxes();
        const structured = { folders: mbs };
        if (response_format === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(mbs, null, 2) }],
            structuredContent: structured,
          };
        }
        const lines = [
          "| Path | Name | Special-use | Flags |",
          "|---|---|---|---|",
          ...mbs.map(
            (m) =>
              `| \`${m.path}\` | ${m.name} | ${m.specialUse ?? "—"} | ${m.flags.join(", ") || "—"} |`,
          ),
        ];
        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: structured,
        };
      },
    );

    register(
      "proton_create_folder",
      {
        title: "Create a mailbox (folder)",
        description:
          "Creates a new IMAP mailbox under the given path (e.g. 'Projects/Afiladocs').",
        inputSchema: {
          path: z.string().min(1).describe("Mailbox path to create"),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ path }) => {
        const res = await imap.createMailbox(path);
        return {
          content: [
            { type: "text", text: `Created ${res.path} (new=${res.created}).` },
          ],
        };
      },
    );

    register(
      "proton_mailbox_status",
      {
        title: "Get mailbox counts",
        description:
          "Returns total messages, unseen/unread count and recent count for a mailbox. Fast — useful for Routines to check 'do I have unread mail?'.",
        inputSchema: {
          mailbox: z
            .string()
            .default("INBOX")
            .describe("Mailbox path, e.g. INBOX"),
        },
        outputSchema: mailboxStatusSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
          idempotentHint: true,
        },
      },
      async ({ mailbox }) => {
        const s = await imap.mailboxStatus(mailbox);
        return {
          content: [
            {
              type: "text",
              text: `**${mailbox}** — total: ${s.messages}, unseen: ${s.unseen}, recent: ${s.recent}${s.uidNext ? `, uidNext: ${s.uidNext}` : ""}`,
            },
          ],
          structuredContent: {
            mailbox,
            messages: s.messages,
            unseen: s.unseen,
            recent: s.recent,
            ...(s.uidNext ? { uidNext: s.uidNext } : {}),
          },
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Listing and search
  // ---------------------------------------------------------------------------
  function registerListSearchTools() {
    register(
      "proton_list_emails",
      {
        title: "List emails in a mailbox",
        description:
          "Lists recent emails in a mailbox, newest first. Use pagination with offset+limit. Returns UID, from, to, subject, date, flags, size. Does NOT return the body — use proton_get_email for that.",
        inputSchema: {
          mailbox: z.string().default("INBOX"),
          limit: z.number().int().min(1).max(100).default(25),
          offset: z.number().int().min(0).default(0),
          response_format: z.enum(["markdown", "json"]).default("markdown"),
        },
        outputSchema: emailListSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
          idempotentHint: true,
        },
      },
      handleListEmails,
    );

    register(
      "proton_search_emails",
      {
        title: "Search emails",
        description:
          "Keyword-search emails in a mailbox. Filter by text in any field, or restrict to subject/from/to/body. Combine with date range and unseen flag. Returns newest matches first, up to 'limit'. Use 'text' for a broad 'anywhere' match.",
        inputSchema: {
          mailbox: z.string().default("INBOX"),
          query: z.string().optional().describe("Keyword to search for"),
          fields: z
            .array(z.enum(["text", "subject", "from", "to", "body"]))
            .default(["text"])
            .describe("Which fields to search. 'text' = anywhere."),
          since: z
            .string()
            .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid ISO date")
            .optional()
            .describe("ISO date — only messages on/after this date"),
          before: z
            .string()
            .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid ISO date")
            .optional()
            .describe("ISO date — only messages before this date"),
          unseen_only: z
            .boolean()
            .default(false)
            .describe("Only return unread messages"),
          from_address: z
            .string()
            .optional()
            .describe("Restrict to messages from this address"),
          to_address: z
            .string()
            .optional()
            .describe("Restrict to messages to this address"),
          limit: z.number().int().min(1).max(100).default(25),
          response_format: z.enum(["markdown", "json"]).default("markdown"),
        },
        outputSchema: emailSearchSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
          idempotentHint: true,
        },
      },
      handleSearchEmails,
    );
  }

  async function handleListEmails({
    mailbox,
    limit,
    offset,
    response_format,
  }: {
    mailbox: string;
    limit: number;
    offset: number;
    response_format: "markdown" | "json";
  }) {
    const { items, total } = await imap.listEmails(mailbox, limit, offset);
    const structured = {
      mailbox,
      total,
      count: items.length,
      offset,
      has_more: offset + items.length < total,
      next_offset: offset + items.length,
      items,
    };
    if (response_format === "json") {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(structured, null, 2) },
        ],
        structuredContent: structured,
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: renderEmailList(items, mailbox, total, offset),
        },
      ],
      structuredContent: structured,
    };
  }

  async function handleSearchEmails(
    args: {
      mailbox: string;
      query?: string;
      fields: ("text" | "subject" | "from" | "to" | "body")[];
      since?: string;
      before?: string;
      unseen_only: boolean;
      from_address?: string;
      to_address?: string;
      limit: number;
      response_format: "markdown" | "json";
    },
  ) {
    const criteria = buildSearchCriteria(args);
    const { items, matched } = await imap.searchEmails(
      args.mailbox,
      criteria,
      args.limit,
    );
    const structured = {
      mailbox: args.mailbox,
      matched,
      count: items.length,
      has_more: matched > items.length,
      items,
    };
    if (args.response_format === "json") {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(structured, null, 2) },
        ],
        structuredContent: structured,
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: `Matched ${matched} message(s), showing ${items.length}.\n\n${renderEmailList(items, args.mailbox, matched, 0)}`,
        },
      ],
      structuredContent: structured,
    };
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------
  function registerReadTools() {
    register(
      "proton_get_email",
      {
        title: "Read one email (full body)",
        description:
          "Fetches one email by UID, with headers, text/html body and attachment metadata. Use proton_get_attachment to download attachment bytes. Large HTML bodies are returned as-is — truncate client-side if needed. To mark as read, call proton_flag_email separately (keeps this tool purely read-only).",
        inputSchema: {
          mailbox: z.string().default("INBOX"),
          uid: z
            .number()
            .int()
            .positive()
            .describe("Message UID (from list/search)"),
          include_html: z
            .boolean()
            .default(false)
            .describe("Include HTML body in addition to text"),
          response_format: z.enum(["markdown", "json"]).default("markdown"),
        },
        outputSchema: emailFullSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
          idempotentHint: true,
        },
      },
      async ({ mailbox, uid, include_html, response_format }) => {
        const msg = await imap.getEmail(mailbox, uid);
        if (!msg) {
          return {
            isError: true,
            content: [
              { type: "text", text: `No message with UID ${uid} in ${mailbox}.` },
            ],
          };
        }
        const out = include_html ? msg : { ...msg, htmlBody: undefined };
        const text =
          response_format === "json"
            ? JSON.stringify(out, null, 2)
            : renderFullEmail(out);
        return {
          content: [{ type: "text", text }],
          structuredContent: out as unknown as Record<string, unknown>,
        };
      },
    );

    register(
      "proton_get_attachment",
      {
        title: "Download an attachment",
        description:
          "Returns the bytes of a specific attachment encoded as base64. Use the attachment index from proton_get_email. Large attachments are truncated to max_bytes (default 10 MB) with a truncated=true flag in the response.",
        inputSchema: {
          mailbox: z.string().default("INBOX"),
          uid: z.number().int().positive(),
          index: z
            .number()
            .int()
            .min(0)
            .describe("Zero-based index in the attachments array"),
          max_bytes: z
            .number()
            .int()
            .positive()
            .max(50 * 1024 * 1024)
            .default(10 * 1024 * 1024)
            .describe(
              "Maximum attachment size in bytes (default 10 MB, hard cap 50 MB)",
            ),
        },
        outputSchema: attachmentSchema,
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
          idempotentHint: true,
        },
      },
      async ({ mailbox, uid, index, max_bytes }) => {
        const att = await imap.getAttachment(mailbox, uid, index);
        if (!att) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Attachment #${index} not found for UID ${uid}.`,
              },
            ],
          };
        }
        // Defensa contra "adjunto gigante satura el contexto del LLM".
        // Devolvemos siempre `size_bytes` (original) y `returned_bytes` (real
        // servido) para que el consumidor pueda decidir si reintentar con
        // max_bytes más alto o solicitar por otra vía.
        const bytes = Buffer.from(att.base64, "base64");
        const truncated = bytes.byteLength > max_bytes;
        const payload = truncated ? bytes.subarray(0, max_bytes) : bytes;
        const structured = {
          filename: att.filename,
          contentType: att.contentType,
          size_bytes: bytes.byteLength,
          returned_bytes: payload.byteLength,
          truncated,
          base64: payload.toString("base64"),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(structured) }],
          structuredContent: structured,
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Send / reply / forward
  // ---------------------------------------------------------------------------
  function registerSendTools() {
    register(
      "proton_send_email",
      {
        title: "Send an email",
        description:
          "Sends an email via Proton Bridge SMTP. 'from' is fixed to the configured address. Provide either text, html, or both. Attachments are base64-encoded bytes.",
        inputSchema: {
          to: z.array(z.string().email()).min(1).describe("Recipient addresses"),
          subject: z.string().min(1),
          text: z.string().optional(),
          html: z.string().optional(),
          cc: z.array(z.string().email()).optional(),
          bcc: z.array(z.string().email()).optional(),
          reply_to: z.string().email().optional(),
          attachments: z
            .array(
              z.object({
                filename: z.string(),
                content_base64: z.string(),
                content_type: z.string().optional(),
              }),
            )
            .optional(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async (args) => {
        if (!args.text && !args.html) {
          return {
            isError: true,
            content: [
              { type: "text", text: "Provide at least one of 'text' or 'html'." },
            ],
          };
        }
        const res = await smtp.send({
          to: args.to,
          cc: args.cc,
          bcc: args.bcc,
          subject: args.subject,
          text: args.text,
          html: args.html,
          replyTo: args.reply_to,
          attachments: args.attachments?.map((a) => ({
            filename: a.filename,
            contentBase64: a.content_base64,
            contentType: a.content_type,
          })),
        });
        return {
          content: [
            {
              type: "text",
              text: `Sent. messageId=${res.messageId} accepted=${res.accepted.length} rejected=${res.rejected.length}`,
            },
          ],
        };
      },
    );

    register(
      "proton_reply_email",
      {
        title: "Reply to an email",
        description:
          "Replies to an existing message preserving threading (In-Reply-To, References). Set reply_all=true to include CC recipients. Set include_quote=true to quote the original.",
        inputSchema: {
          mailbox: z.string().default("INBOX"),
          uid: z.number().int().positive(),
          text: z.string().optional(),
          html: z.string().optional(),
          reply_all: z.boolean().default(false),
          include_quote: z.boolean().default(true),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async (args) => {
        if (!args.text && !args.html) {
          return {
            isError: true,
            content: [
              { type: "text", text: "Provide at least one of 'text' or 'html'." },
            ],
          };
        }
        const opts = await buildReplyOptions(
          imap,
          args.mailbox,
          args.uid,
          { text: args.text, html: args.html },
          args.include_quote,
          args.reply_all,
          cfg.products.mail.bridge.from,
        );
        if (!opts)
          return {
            isError: true,
            content: [
              { type: "text", text: `Original UID ${args.uid} not found.` },
            ],
          };
        if (opts.to.length === 0)
          return {
            isError: true,
            content: [
              { type: "text", text: "Original has no reply-to address." },
            ],
          };
        const res = await smtp.send(opts);
        return {
          content: [
            {
              type: "text",
              text: `Reply sent to ${opts.to.join(", ")}. messageId=${res.messageId} accepted=${res.accepted.length}`,
            },
          ],
        };
      },
    );

    register(
      "proton_forward_email",
      {
        title: "Forward an email",
        description:
          "Forwards an existing message to new recipients. Optionally includes original attachments.",
        inputSchema: {
          mailbox: z.string().default("INBOX"),
          uid: z.number().int().positive(),
          to: z.array(z.string().email()).min(1),
          text: z.string().optional(),
          html: z.string().optional(),
          include_attachments: z.boolean().default(true),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async (args) => {
        const opts = await buildForwardOptions(
          imap,
          args.mailbox,
          args.uid,
          args.to,
          { text: args.text, html: args.html },
          args.include_attachments,
        );
        if (!opts)
          return {
            isError: true,
            content: [
              { type: "text", text: `Original UID ${args.uid} not found.` },
            ],
          };
        const res = await smtp.send(opts);
        return {
          content: [
            {
              type: "text",
              text: `Forwarded to ${args.to.join(", ")}. messageId=${res.messageId}`,
            },
          ],
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Modify
  // ---------------------------------------------------------------------------
  function registerModifyTools() {
    register(
      "proton_flag_email",
      {
        title: "Flag / unflag emails",
        description:
          "Toggles per-message flags. Supported: 'read', 'unread', 'starred', 'unstarred'. For custom flags, pass add_flags/remove_flags directly.",
        inputSchema: {
          mailbox: z.string().default("INBOX"),
          uid: z.number().int().positive(),
          action: z
            .enum(["read", "unread", "starred", "unstarred", "custom"])
            .describe("Shorthand action"),
          add_flags: z
            .array(z.string())
            .optional()
            .describe("Custom flags to add (action=custom only)"),
          remove_flags: z
            .array(z.string())
            .optional()
            .describe("Custom flags to remove (action=custom only)"),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async ({ mailbox, uid, action, add_flags, remove_flags }) => {
        let add: string[] = [];
        let remove: string[] = [];
        switch (action) {
          case "read":
            add = ["\\Seen"];
            break;
          case "unread":
            remove = ["\\Seen"];
            break;
          case "starred":
            add = ["\\Flagged"];
            break;
          case "unstarred":
            remove = ["\\Flagged"];
            break;
          case "custom":
            add = add_flags ?? [];
            remove = remove_flags ?? [];
            break;
        }
        const ok = await imap.setFlags(mailbox, uid, add, remove);
        return {
          content: [
            {
              type: "text",
              text: ok
                ? `Flags updated on UID ${uid}.`
                : `Failed to update flags on UID ${uid}.`,
            },
          ],
        };
      },
    );

    register(
      "proton_move_email",
      {
        title: "Move an email to another mailbox",
        description:
          "Moves a message by UID from one mailbox to another. Use proton_list_folders to see valid targets.",
        inputSchema: {
          from_mailbox: z.string(),
          uid: z.number().int().positive(),
          to_mailbox: z.string(),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ from_mailbox, uid, to_mailbox }) => {
        const ok = await imap.moveEmail(from_mailbox, uid, to_mailbox);
        return {
          content: [
            {
              type: "text",
              text: ok ? `Moved UID ${uid} → ${to_mailbox}` : `Move failed.`,
            },
          ],
        };
      },
    );

    register(
      "proton_delete_email",
      {
        title: "Delete an email",
        description:
          "Deletes a message. Default mode='trash' moves it to Trash (reversible). mode='permanent' expunges immediately — cannot be undone.",
        inputSchema: {
          mailbox: z.string().default("INBOX"),
          uid: z.number().int().positive(),
          mode: z.enum(["trash", "permanent"]).default("trash"),
          trash_path: z
            .string()
            .optional()
            .describe(
              "Override for the Trash mailbox path. If omitted, the \\Trash special-use mailbox is auto-detected (works with Papelera/Corbeille/etc.).",
            ),
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ mailbox, uid, mode, trash_path }) => {
        if (mode === "trash") {
          const target = await resolveTrashPath(trash_path);
          const ok = await imap.moveEmail(mailbox, uid, target);
          return {
            content: [
              {
                type: "text",
                text: ok
                  ? `Moved UID ${uid} to ${target}.`
                  : "Delete-to-trash failed.",
              },
            ],
          };
        }
        const ok = await imap.deleteEmail(mailbox, uid);
        return {
          content: [
            {
              type: "text",
              text: ok ? `Permanently deleted UID ${uid}.` : "Delete failed.",
            },
          ],
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Agent
  // ---------------------------------------------------------------------------
  function registerAgentTools() {
    register(
      "proton_agent_plan",
      {
        title: "Get agent organization/alert plan",
        description:
          "Analyzes the mailbox using the embedded agent rules and returns a proposed folder/label structure plus content alerts. This is a read-only planning tool; it does not move, flag or delete emails. Use it before running the CLI agent:organize command.",
        inputSchema: {
          goal: z
            .enum(["organize", "monitor", "alert"])
            .default("organize")
            .describe("Agent goal: organize (propose folders/labels), monitor (inspect only), alert (threats only)."),
          response_format: z
            .enum(["markdown", "json"])
            .default("json")
            .describe("Output format. JSON is recommended for programmatic consumers."),
        },
        outputSchema: {
          newFolders: z.array(z.string()),
          folderProposals: z.array(
            z.object({ path: z.string(), reason: z.string(), emails: z.array(z.number()) }),
          ),
          labelProposals: z.array(
            z.object({ name: z.string(), reason: z.string(), emails: z.array(z.number()) }),
          ),
          alerts: z.array(
            z.object({
              severity: z.enum(["info", "warning", "alert", "critical"]),
              category: z.string(),
              message: z.string(),
              uids: z.array(z.number()),
            }),
          ),
        },
        annotations: {
          readOnlyHint: true,
          openWorldHint: true,
          idempotentHint: true,
        },
      },
      async ({ goal, response_format }) => {
        const ctx = buildGoalContext(parseGoal(goal), cfg.agent);
        // Force read-only: even if the operator disabled dryRun, this tool never writes.
        const readOnlyCtx = { ...ctx, dryRun: true };
        const plan = await buildOrganizationPlan(cfg, readOnlyCtx, log, alerts);
        if (response_format === "json") {
          return {
            content: [{ type: "text", text: JSON.stringify(plan, null, 2) }],
            structuredContent: plan,
          };
        }
        const lines = [
          `# Plan del agente (${goal})`,
          "",
          "## Carpetas propuestas",
          ...plan.newFolders.map((f) => `- **${f}** (nueva)`),
          "",
          "## Movimientos propuestos",
          ...plan.folderProposals.map((p) => `- ${p.path}: ${p.emails.length} correos — ${p.reason}`),
          "",
          "## Etiquetas propuestas",
          ...plan.labelProposals.map((p) => `- ${p.name}: ${p.emails.length} correos — ${p.reason}`),
          "",
          "## Alertas",
          ...plan.alerts.map((a) => `- [${a.severity}] ${a.message}`),
        ];
        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: plan,
        };
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Proton Pass
  // ---------------------------------------------------------------------------
  function registerPassTools() {
    if (!cfg.products.pass.enabled) return;
    const passClient = new PassClient({ storeDir: cfg.products.pass.storeDir }, log);

    register(
      "proton_pass_list",
      { title: "List Proton Pass entries", description: "Lists entries in the Proton Pass password store. Returns entry names/paths only — NEVER secret values.",
        inputSchema: { filter: z.string().optional(), response_format: z.enum(["markdown", "json"]).default("json") },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async ({ filter, response_format }) => {
        try {
          const entries = await passClient.list(filter);
          if (response_format === "json") {
            return { content: [{ type: "text", text: JSON.stringify({ entries, count: entries.length }) }] };
          }
          return { content: [{ type: "text", text: entries.length === 0 ? "No entries found." : `**${entries.length} entries:**\n${entries.map((e) => `- ${e}`).join("\n")}` }] };
        } catch (err) { return { isError: true, content: [{ type: "text", text: String(err) }] }; }
      },
    );

    register(
      "proton_pass_get",
      { title: "Resolve a secret from Proton Pass", description: "Resolves a secret from Proton Pass. Returns {found:true} without the secret value.",
        inputSchema: { path: z.string().describe("Entry path in the password store") },
        annotations: { openWorldHint: true },
      },
      async ({ path }) => {
        try {
          await passClient.get(path);
          return { content: [{ type: "text", text: JSON.stringify({ found: true, path, injected: true }) }] };
        } catch (err) { return { content: [{ type: "text", text: JSON.stringify({ found: false, path, error: String(err) }) }] }; }
      },
    );

    register(
      "proton_pass_generate",
      { title: "Generate a secure password", description: "Generates a strong random password and saves it to the Proton Pass store.",
        inputSchema: { path: z.string(), length: z.number().int().min(12).max(128).default(24) },
        annotations: { destructiveHint: true, openWorldHint: true },
      },
      async ({ path, length }) => {
        try {
          const result = await passClient.generate(path, length);
          return { content: [{ type: "text", text: JSON.stringify({ generated: true, ...result }) }] };
        } catch (err) { return { isError: true, content: [{ type: "text", text: String(err) }] }; }
      },
    );

    register(
      "proton_pass_health",
      { title: "Check Proton Pass store health", description: "Verifies the Proton Pass password store is accessible.",
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async () => { const r = await passClient.health(); return { content: [{ type: "text", text: JSON.stringify(r) }] }; },
    );
  }

  // ---------------------------------------------------------------------------
  // Calendar stubs
  // ---------------------------------------------------------------------------
  function registerCalendarTools() {
    if (!cfg.products.calendar.enabled) return;
    const unavailable = JSON.stringify({ available: false, reason: "Calendar CalDAV not yet exposed by Proton Bridge." });
    for (const t of ["proton_calendar_list_events", "proton_calendar_create_event", "proton_calendar_list_calendars"]) {
      register(t, { title: t, description: `[STUB] ${t}`, annotations: { readOnlyHint: true, openWorldHint: true } },
        async () => ({ content: [{ type: "text", text: unavailable }] }));
    }
  }

  // ---------------------------------------------------------------------------
  // Drive stubs
  // ---------------------------------------------------------------------------
  function registerDriveTools() {
    if (!cfg.products.drive.enabled) return;
    const unavailable = JSON.stringify({ available: false, reason: "Drive OAuth not yet configured." });
    const tools = ["proton_drive_list_files", "proton_drive_upload_file", "proton_drive_download_file", "proton_drive_delete_file", "proton_drive_share_file"];
    for (const t of tools) {
      register(t, { title: t, description: `[STUB] ${t}`, annotations: { openWorldHint: true } },
        async () => ({ content: [{ type: "text", text: unavailable }] }));
    }
  }

  // ---------------------------------------------------------------------------
  // Suite status with diagnostics
  // ---------------------------------------------------------------------------
  function registerSuiteTool() {
    register(
      "proton_suite_status",
      {
        title: "Get Proton Suite unified status",
        description: "Reports the connection status, diagnostics, and metrics of all configured Proton Suite products.",
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async () => {
        let mailStatus: Record<string, unknown> = { available: false, error: "not_configured" };
        let passStatus: Record<string, unknown> = { available: false, error: "not_configured" };

        if (cfg.products.mail.enabled) {
          try {
            const { diagnoseMail } = await import("./diagnostics.js");
            const diag = await diagnoseMail(bridgeCfg, passwordResolver);
            let connected = false;
            let mailboxes: number | undefined;
            let unread: number | undefined;
            if (diag.auth?.ok && diag.folders?.accessible) {
              connected = true;
              mailboxes = diag.folders?.count;
              try {
                const folders = await imap.listMailboxes();
                const status = await imap.mailboxStatus("INBOX");
                mailboxes = folders.length;
                unread = status?.unseen ?? 0;
              } catch { /* fallback to diagnostics count */ }
            }
            mailStatus = { available: true, connected, mailboxes, unread, error: connected ? undefined : (diag.auth?.error ?? diag.imapHandshake?.error ?? diag.tcp.error), diagnostics: diag };
          } catch (err) { mailStatus = { available: false, connected: false, error: String(err) }; }
        }

        if (cfg.products.pass.enabled) {
          try {
            const pc = new PassClient({ storeDir: cfg.products.pass.storeDir }, log);
            const h = await pc.health();
            passStatus = { available: true, connected: h.ok, entries: h.entries, error: h.error };
          } catch (err) { passStatus = { available: false, connected: false, error: String(err) }; }
        }

        return { content: [{ type: "text", text: JSON.stringify({
          mail: mailStatus, pass: passStatus,
          calendar: cfg.products.calendar.enabled ? { available: false, reason: "CalDAV not yet exposed by Bridge" } : { available: false },
          drive: cfg.products.drive.enabled ? { available: false, reason: "OAuth not yet configured" } : { available: false },
        }, null, 2) }] };
      },
    );
  }
}

// -----------------------------------------------------------------------------
// Renderers
// -----------------------------------------------------------------------------
function renderEmailList(
  items: {
    uid: number;
    from?: string;
    subject?: string;
    date?: string;
    flags: string[];
  }[],
  mailbox: string,
  total: number,
  offset: number,
): string {
  if (items.length === 0) return `No messages in ${mailbox} (total: ${total}).`;
  const head = `**${mailbox}** — showing ${items.length} of ${total} (offset ${offset})\n\n| UID | Date | From | Subject | Flags |\n|---|---|---|---|---|`;
  const rows = items.map((m) => {
    const date = m.date ? m.date.slice(0, 16).replace("T", " ") : "—";
    const from = truncate(m.from ?? "—", 32);
    const subject = truncate(m.subject ?? "(no subject)", 50);
    const flags = m.flags.join(" ") || "—";
    return `| ${m.uid} | ${date} | ${from} | ${subject} | ${flags} |`;
  });
  return [head, ...rows].join("\n");
}

function renderFullEmail(m: {
  uid: number;
  from?: string;
  to: string[];
  cc: string[];
  subject?: string;
  date?: string;
  flags: string[];
  textBody?: string;
  htmlBody?: string;
  attachments: { filename?: string; contentType: string; size: number }[];
}): string {
  const lines = [
    `**Subject:** ${m.subject ?? "(no subject)"}`,
    `**From:** ${m.from ?? "—"}`,
    `**To:** ${m.to.join(", ") || "—"}`,
    m.cc.length > 0 ? `**Cc:** ${m.cc.join(", ")}` : null,
    `**Date:** ${m.date ?? "—"}`,
    `**UID:** ${m.uid}   **Flags:** ${m.flags.join(" ") || "—"}`,
    "",
    "---",
    "",
    m.textBody ?? "(no text body)",
  ].filter((x) => x !== null);
  if (m.attachments.length > 0) {
    lines.push("", "**Attachments:**");
    m.attachments.forEach((a, i) => {
      lines.push(
        `- [${i}] ${a.filename ?? "unnamed"} — ${a.contentType} — ${(a.size / 1024).toFixed(1)} KB`,
      );
    });
  }
  if (m.htmlBody) {
    lines.push(
      "",
      "---",
      "HTML body present (fetch with include_html=true and response_format=json to retrieve).",
    );
  }
  return lines.join("\n");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// -----------------------------------------------------------------------------
// Search criteria builder
// -----------------------------------------------------------------------------

/** Construye el objeto `SearchObject` de imapflow a partir de los argumentos de
 * `proton_search_emails`. Aísla la lógica de mapeo de campos (body/subject/from/to)
 * y evita que un filtro `from_address`/`to_address` explícito sea pisado por el
 * campo genérico `fields`. */
function buildSearchCriteria(args: {
  query?: string;
  fields: ("text" | "subject" | "from" | "to" | "body")[];
  since?: string;
  before?: string;
  unseen_only: boolean;
  from_address?: string;
  to_address?: string;
}): SearchObject {
  const criteria: SearchObject = {};
  if (args.unseen_only) criteria.seen = false;
  if (args.since) criteria.since = new Date(args.since);
  if (args.before) criteria.before = new Date(args.before);
  if (args.from_address) criteria.from = args.from_address;
  if (args.to_address) criteria.to = args.to_address;
  if (args.query) {
    for (const f of args.fields) {
      if (f === "text") criteria.body = args.query;
      if (f === "subject") criteria.subject = args.query;
      // Un `from_address` explícito gana sobre `fields:["from"]` para
      // evitar sobreescribir un filtro más específico.
      if (f === "from" && !criteria.from) criteria.from = args.query;
      if (f === "to" && !criteria.to) criteria.to = args.query;
      if (f === "body") criteria.body = args.query;
    }
  }
  return criteria;
}
