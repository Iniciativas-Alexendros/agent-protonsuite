import { z } from 'zod'

export const mailboxSchema = z.object({
  path: z.string(),
  name: z.string(),
  specialUse: z.string().nullish(),
  flags: z.array(z.string()),
  delimiter: z.string().nullable().optional(),
  subscribed: z.boolean().optional(),
})

export const folderListSchema = { folders: z.array(mailboxSchema) }

export const mailboxStatusSchema = {
  mailbox: z.string(),
  messages: z.number().int(),
  unseen: z.number().int(),
  recent: z.number().int(),
  uidNext: z.number().int().optional(),
}

export const emailHeaderSchema = z.object({
  uid: z.number().int(),
  from: z.string().optional(),
  to: z.array(z.string()).optional(),
  subject: z.string().optional(),
  date: z.string().optional(),
  flags: z.array(z.string()),
  size: z.number().int().optional(),
})

export const emailListSchema = {
  mailbox: z.string(),
  total: z.number().int(),
  count: z.number().int(),
  offset: z.number().int(),
  has_more: z.boolean(),
  next_offset: z.number().int().optional(),
  items: z.array(emailHeaderSchema),
}

export const emailSearchSchema = {
  mailbox: z.string(),
  matched: z.number().int(),
  count: z.number().int(),
  has_more: z.boolean(),
  items: z.array(emailHeaderSchema),
}

export const emailFullSchema = {
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
}

export const attachmentSchema = {
  filename: z.string().optional(),
  contentType: z.string(),
  size_bytes: z.number().int(),
  returned_bytes: z.number().int(),
  truncated: z.boolean(),
  base64: z.string(),
}
