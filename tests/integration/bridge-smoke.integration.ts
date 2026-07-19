import { ImapFlow } from 'imapflow'
import nodemailer from 'nodemailer'
import { describe, afterEach, expect } from 'vitest'
import { integrationTest, loadCredentials } from './helpers'

describe('Bridge — IMAP smoke', () => {
  let client: ImapFlow | null = null

  afterEach(async () => {
    if (client) {
      try {
        await client.logout()
      } catch {
        /* noop */
      }
      client = null
    }
  })

  integrationTest('connects and lists mailboxes', async () => {
    const creds = loadCredentials()!
    client = new ImapFlow({
      host: creds.bridgeHost,
      port: creds.bridgeImapPort,
      secure: false,
      tls: { rejectUnauthorized: !creds.tlsInsecure },
      auth: { user: creds.bridgeUser, pass: creds.bridgePass },
      logger: false,
    })
    await client.connect()
    const list = await client.list()
    const inbox = list.find(
      (m) => m.path === 'INBOX' || m.flags.has('\\Inbox'),
    )
    expect(inbox).toBeDefined()
    await client.logout()
    client = null
  })
})

describe('Bridge — SMTP smoke', () => {
  integrationTest('sends email to self and polls INBOX', async () => {
    const creds = loadCredentials()!
    const subject = `integration-test-${Date.now()}`
    const transporter = nodemailer.createTransport({
      host: creds.bridgeHost,
      port: creds.bridgeSmtpPort,
      secure: false,
      requireTLS: true,
      tls: { rejectUnauthorized: !creds.tlsInsecure },
      auth: { user: creds.bridgeUser, pass: creds.bridgePass },
    })

    await transporter.sendMail({
      from: creds.bridgeUser,
      to: creds.bridgeUser,
      subject,
      text: 'Integration test payload',
    })
    transporter.close()

    const imapClient = new ImapFlow({
      host: creds.bridgeHost,
      port: creds.bridgeImapPort,
      secure: false,
      tls: { rejectUnauthorized: !creds.tlsInsecure },
      auth: { user: creds.bridgeUser, pass: creds.bridgePass },
      logger: false,
    })
    await imapClient.connect()

    const deadline = Date.now() + 60_000
    let found = false
    while (Date.now() < deadline) {
      const lock = await imapClient.getMailboxLock('INBOX')
      try {
        const searchResult = await imapClient.search({ subject }, { uid: true })
        const uids = Array.isArray(searchResult) ? searchResult : []
        if (uids.length > 0) {
          found = true
          break
        }
      } finally {
        lock.release()
      }
      await new Promise((r) => setTimeout(r, 2_000))
    }

    await imapClient.logout()
    expect(found).toBe(true)
  })
})
