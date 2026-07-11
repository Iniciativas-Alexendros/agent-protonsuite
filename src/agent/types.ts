export type AgentGoal =
  | 'discover'
  | 'setup'
  | 'organize'
  | 'monitor'
  | 'alert'
  | 'check-imap'
  | 'pass-audit'
  | 'suite-status'
  | 'drive-audit'
  | 'drive-organize'
  | 'drive-list'
  | 'drive-download'
  | 'drive-upload'

export interface GoalContext {
  goal: AgentGoal
  dryRun: boolean
  maxInspectEmails: number
  minConfidence: number
}

export interface FolderProposal {
  path: string
  reason: string
  emails: number[]
  suggestedLabels?: string[]
}

export interface LabelProposal {
  name: string
  reason: string
  emails: number[]
}

export interface OrganizationPlan {
  [x: string]: unknown
  newFolders: string[]
  folderProposals: FolderProposal[]
  labelProposals: LabelProposal[]
  alerts: {
    severity: 'info' | 'warning' | 'alert' | 'critical'
    category: string
    message: string
    uids: number[]
  }[]
}

export interface SetupReport {
  bridgeReachable: boolean
  imapOk: boolean
  smtpOk: boolean
  authOk: boolean
  folders: string[]
  recommendations: string[]
}

export interface PassAuditReport {
  storeOk: boolean
  totalEntries: number
  weakPasswords: string[]
  duplicates: string[]
  staleEntries: string[]
  recommendations: string[]
}

export interface SuiteStatusReport {
  mail: {
    available: boolean
    connected?: boolean
    mailboxes?: number
    unread?: number
    error?: string
  }
  pass: {
    available: boolean
    connected?: boolean
    entries?: number
    error?: string
  }
  calendar: { available: boolean; reason?: string }
  drive: { available: boolean; reason?: string }
}
