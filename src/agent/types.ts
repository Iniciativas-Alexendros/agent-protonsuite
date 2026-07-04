export type AgentGoal = "discover" | "setup" | "organize" | "monitor" | "alert" | "check-imap";

export interface GoalContext {
  goal: AgentGoal;
  dryRun: boolean;
  maxInspectEmails: number;
  minConfidence: number;
}

export interface FolderProposal {
  path: string;
  reason: string;
  emails: number[];
  suggestedLabels?: string[];
}

export interface LabelProposal {
  name: string;
  reason: string;
  emails: number[];
}

export interface OrganizationPlan {
  [x: string]: unknown;
  newFolders: string[];
  folderProposals: FolderProposal[];
  labelProposals: LabelProposal[];
  alerts: Array<{
    severity: "info" | "warning" | "alert" | "critical";
    category: string;
    message: string;
    uids: number[];
  }>;
}

export interface SetupReport {
  bridgeReachable: boolean;
  imapOk: boolean;
  smtpOk: boolean;
  authOk: boolean;
  folders: string[];
  recommendations: string[];
}
