/**
 * Cobertura de las 13 tools `proton_*` registradas en `buildServer`.
 *
 * Estrategia: `imapflow`, `nodemailer` y `mailparser` se MOCKEAN con `vi.mock`,
 * así no hay red real contra Bridge. Levantamos un `McpServer` real vía
 * `buildServer` y un `Client` del SDK conectados por `InMemoryTransport`.
 * Llamar a las tools por el cliente ejercita la validación Zod del
 * `inputSchema` (un input válido y uno inválido por tool) y el happy-path con
 * el mock devolviendo datos.
 *
 * Nota sobre validación: el SDK MCP NO lanza ante `arguments` inválidos —
 * devuelve un resultado con `isError: true` y un texto "Input validation
 * error" (JSON-RPC -32602). Por eso los casos inválidos se asertan vía
 * `expectValidationError`, no con `.rejects`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// -----------------------------------------------------------------------------
// Mock state, mutable per-test
// -----------------------------------------------------------------------------
const imapState = {
  listResult: [] as unknown[],
  statusResult: {} as Record<string, unknown>,
  fetchResults: [] as unknown[],
  fetchOneResult: null as unknown,
  searchResult: [] as number[],
  mailboxCreateResult: { path: "X", created: true },
  moveResult: true,
  deleteResult: true,
  flagsAddResult: true,
  flagsRemoveResult: true,
};

const sendMailMock = vi.fn(async () => ({
  messageId: "<generated@local>",
  accepted: ["bob@example.com"],
  rejected: [],
  response: "250 OK",
}));

vi.mock("imapflow", () => {
  class ImapFlow {
    usable = true;
    on() {}
    async connect() {}
    async logout() {}
    async list() {
      return imapState.listResult;
    }
    async mailboxCreate() {
      return imapState.mailboxCreateResult;
    }
    async status() {
      return imapState.statusResult;
    }
    async getMailboxLock() {
      return { release() {} };
    }
    async *fetch() {
      for (const m of imapState.fetchResults) yield m;
    }
    async fetchOne() {
      return imapState.fetchOneResult;
    }
    async search() {
      return imapState.searchResult;
    }
    async messageMove() {
      return imapState.moveResult;
    }
    async messageDelete() {
      return imapState.deleteResult;
    }
    async messageFlagsAdd() {
      return imapState.flagsAddResult;
    }
    async messageFlagsRemove() {
      return imapState.flagsRemoveResult;
    }
    async append() {
      return { uid: 1 };
    }
  }
  return { ImapFlow };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: sendMailMock,
      close() {},
    }),
  },
}));

// mailparser stub: source Buffer is irrelevant, we return a fixed parsed mail.
vi.mock("mailparser", () => ({
  simpleParser: async () => ({
    headers: new Map<string, string>([["references", ""]]),
    cc: undefined,
    bcc: undefined,
    replyTo: undefined,
    text: "Hello body",
    html: "<p>Hello body</p>",
    attachments: [
      {
        filename: "a.txt",
        contentType: "text/plain",
        size: 5,
        content: Buffer.from("hello"),
        contentId: undefined,
        checksum: undefined,
      },
    ],
  }),
}));

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.js";
import type { Config } from "../src/config.js";

const cfg: Config = {
  bridge: {
    user: "me@proton.me",
    pass: "x",
    host: "127.0.0.1",
    imapPort: 1143,
    smtpPort: 1025,
    from: "me@proton.me",
    tlsInsecure: true,
  },
  transport: {
    kind: "stdio",
    httpHost: "127.0.0.1",
    httpPort: 8787,
    allowedOrigins: [],
  },
  logLevel: "error",
};

const silentLog = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

async function makeClient() {
  const { server } = buildServer(cfg, silentLog as never);
  const client = new Client({ name: "test", version: "1.0.0" });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return client;
}

function firstText(res: { content: unknown }): string {
  return (res.content as { text: string }[])[0]!.text;
}

/** Asserts the SDK returned a Zod input-validation error (isError + -32602 text). */
async function expectValidationError(
  name: string,
  args: Record<string, unknown>,
) {
  const client = await makeClient();
  const res = await client.callTool({ name, arguments: args });
  expect(res.isError).toBe(true);
  expect(firstText(res)).toMatch(/validation error/i);
}

// A summary message as imapflow's fetch yields it (envelope + flags + size).
const summaryMsg = {
  uid: 42,
  seq: 1,
  flags: new Set(["\\Seen"]),
  size: 1234,
  envelope: {
    messageId: "<m1@x>",
    from: [{ name: "Alice", address: "alice@example.com" }],
    to: [{ address: "me@proton.me" }],
    subject: "Hi there",
    date: new Date("2026-01-01T10:00:00Z"),
  },
};

beforeEach(() => {
  sendMailMock.mockClear();
  imapState.listResult = [
    {
      path: "INBOX",
      name: "INBOX",
      delimiter: "/",
      flags: new Set(),
      specialUse: "\\Inbox",
      subscribed: true,
      listed: true,
    },
    {
      path: "Trash",
      name: "Trash",
      delimiter: "/",
      flags: new Set(),
      specialUse: "\\Trash",
      subscribed: true,
      listed: true,
    },
  ];
  imapState.statusResult = {
    messages: 10,
    unseen: 3,
    recent: 1,
    uidNext: 100,
    uidValidity: 1,
  };
  imapState.fetchResults = [summaryMsg];
  imapState.fetchOneResult = {
    uid: 42,
    seq: 1,
    source: Buffer.from("raw"),
    flags: new Set(["\\Seen"]),
    size: 1234,
    envelope: summaryMsg.envelope,
  };
  imapState.searchResult = [42];
  imapState.moveResult = true;
  imapState.deleteResult = true;
  imapState.flagsAddResult = true;
  imapState.flagsRemoveResult = true;
});

// -----------------------------------------------------------------------------
describe("buildServer · tool registration", () => {
  it("exposes exactly 13 proton_* tools", async () => {
    const client = await makeClient();
    const { tools } = await client.listTools();
    expect(tools.filter((t) => t.name.startsWith("proton_"))).toHaveLength(13);
  });
});

// -----------------------------------------------------------------------------
// Folders
// -----------------------------------------------------------------------------
describe("proton_list_folders", () => {
  it("happy path returns folders in structuredContent", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_list_folders",
      arguments: { response_format: "json" },
    });
    const sc = res.structuredContent as { folders: { path: string }[] };
    expect(sc.folders.map((f) => f.path)).toEqual(["INBOX", "Trash"]);
  });

  it("rejects invalid response_format (Zod enum)", async () => {
    await expectValidationError("proton_list_folders", {
      response_format: "xml",
    });
  });
});

describe("proton_create_folder", () => {
  it("happy path creates a mailbox", async () => {
    imapState.mailboxCreateResult = { path: "Projects/X", created: true };
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_create_folder",
      arguments: { path: "Projects/X" },
    });
    expect(firstText(res)).toContain("Created Projects/X");
  });

  it("rejects empty path (min(1))", async () => {
    await expectValidationError("proton_create_folder", { path: "" });
  });
});

describe("proton_mailbox_status", () => {
  it("happy path returns counts", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_mailbox_status",
      arguments: { mailbox: "INBOX" },
    });
    const sc = res.structuredContent as { messages: number; unseen: number };
    expect(sc.messages).toBe(10);
    expect(sc.unseen).toBe(3);
  });

  it("rejects non-string mailbox", async () => {
    await expectValidationError("proton_mailbox_status", { mailbox: 123 });
  });
});

// -----------------------------------------------------------------------------
// Listing / search
// -----------------------------------------------------------------------------
describe("proton_list_emails", () => {
  it("happy path lists emails with pagination metadata", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_list_emails",
      arguments: {
        mailbox: "INBOX",
        limit: 25,
        offset: 0,
        response_format: "json",
      },
    });
    const sc = res.structuredContent as {
      total: number;
      items: { uid: number }[];
    };
    expect(sc.total).toBe(10);
    expect(sc.items[0]!.uid).toBe(42);
  });

  it("rejects limit above max (100)", async () => {
    await expectValidationError("proton_list_emails", { limit: 999 });
  });
});

describe("proton_search_emails", () => {
  it("happy path returns matched messages", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_search_emails",
      arguments: {
        mailbox: "INBOX",
        query: "hi",
        fields: ["text"],
        response_format: "json",
      },
    });
    const sc = res.structuredContent as {
      matched: number;
      items: { uid: number }[];
    };
    expect(sc.matched).toBe(1);
    expect(sc.items[0]!.uid).toBe(42);
  });

  it("rejects unknown field in fields enum", async () => {
    await expectValidationError("proton_search_emails", { fields: ["nope"] });
  });
});

// -----------------------------------------------------------------------------
// Read
// -----------------------------------------------------------------------------
describe("proton_get_email", () => {
  it("happy path returns the full email body", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_get_email",
      arguments: { mailbox: "INBOX", uid: 42, response_format: "json" },
    });
    const sc = res.structuredContent as { uid: number; textBody: string };
    expect(sc.uid).toBe(42);
    expect(sc.textBody).toBe("Hello body");
  });

  it("rejects non-positive uid", async () => {
    await expectValidationError("proton_get_email", { uid: 0 });
  });
});

describe("proton_get_attachment", () => {
  it("happy path returns base64 bytes", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_get_attachment",
      arguments: { mailbox: "INBOX", uid: 42, index: 0 },
    });
    const sc = res.structuredContent as {
      filename: string;
      base64: string;
      truncated: boolean;
    };
    expect(sc.filename).toBe("a.txt");
    expect(Buffer.from(sc.base64, "base64").toString()).toBe("hello");
    expect(sc.truncated).toBe(false);
  });

  it("rejects negative index", async () => {
    await expectValidationError("proton_get_attachment", {
      uid: 42,
      index: -1,
    });
  });
});

// -----------------------------------------------------------------------------
// Send / reply / forward
// -----------------------------------------------------------------------------
describe("proton_send_email", () => {
  it("happy path sends and reports messageId", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_send_email",
      arguments: { to: ["bob@example.com"], subject: "Hi", text: "Body" },
    });
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(firstText(res)).toContain("messageId=");
  });

  it("rejects invalid recipient email", async () => {
    await expectValidationError("proton_send_email", {
      to: ["not-an-email"],
      subject: "Hi",
      text: "B",
    });
  });

  it("returns isError when neither text nor html provided", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_send_email",
      arguments: { to: ["bob@example.com"], subject: "Hi" },
    });
    expect(res.isError).toBe(true);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe("proton_reply_email", () => {
  it("happy path replies preserving thread", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_reply_email",
      arguments: { mailbox: "INBOX", uid: 42, text: "Thanks" },
    });
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(firstText(res)).toContain("Reply sent to");
  });

  it("rejects non-integer uid", async () => {
    await expectValidationError("proton_reply_email", { uid: 1.5, text: "x" });
  });
});

describe("proton_forward_email", () => {
  it("happy path forwards to new recipients", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_forward_email",
      arguments: {
        mailbox: "INBOX",
        uid: 42,
        to: ["carol@example.com"],
        include_attachments: false,
      },
    });
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(firstText(res)).toContain("Forwarded to carol@example.com");
  });

  it("rejects empty 'to' array (min 1)", async () => {
    await expectValidationError("proton_forward_email", { uid: 42, to: [] });
  });
});

// -----------------------------------------------------------------------------
// Modify
// -----------------------------------------------------------------------------
describe("proton_flag_email", () => {
  it("happy path marks as read", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_flag_email",
      arguments: { mailbox: "INBOX", uid: 42, action: "read" },
    });
    expect(firstText(res)).toContain("Flags updated on UID 42");
  });

  it("rejects unknown action", async () => {
    await expectValidationError("proton_flag_email", {
      uid: 42,
      action: "burn",
    });
  });
});

describe("proton_move_email", () => {
  it("happy path moves message", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_move_email",
      arguments: { from_mailbox: "INBOX", uid: 42, to_mailbox: "Trash" },
    });
    expect(firstText(res)).toContain("Moved UID 42 → Trash");
  });

  it("rejects missing from_mailbox (required string)", async () => {
    await expectValidationError("proton_move_email", {
      uid: 42,
      to_mailbox: "Trash",
    });
  });
});

describe("proton_delete_email", () => {
  it("happy path trash mode moves to Trash", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_delete_email",
      arguments: {
        mailbox: "INBOX",
        uid: 42,
        mode: "trash",
        trash_path: "Trash",
      },
    });
    expect(firstText(res)).toContain("Moved UID 42 to Trash");
  });

  it("happy path permanent mode expunges", async () => {
    const client = await makeClient();
    const res = await client.callTool({
      name: "proton_delete_email",
      arguments: { mailbox: "INBOX", uid: 42, mode: "permanent" },
    });
    expect(firstText(res)).toContain("Permanently deleted UID 42");
  });

  it("rejects invalid mode enum", async () => {
    await expectValidationError("proton_delete_email", {
      uid: 42,
      mode: "shred",
    });
  });
});
