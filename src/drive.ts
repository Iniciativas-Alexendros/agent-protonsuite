/**
 * Proton Drive client via REST API + OAuth PKCE.
 * Stub implementation — tools registered conditionally when PROTON_DRIVE_CLIENT_ID is set.
 */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  parentId?: string;
}

export class DriveClient {
  constructor(private opts: { accessToken: string }) {}

  async listFiles(_parentId?: string): Promise<DriveFile[]> {
    return [];
  }

  async uploadFile(_parentId: string, _name: string, _content: Buffer): Promise<DriveFile> {
    throw new Error("Not implemented");
  }

  async downloadFile(_fileId: string): Promise<Buffer> {
    throw new Error("Not implemented");
  }

  async deleteFile(_fileId: string): Promise<void> {
    throw new Error("Not implemented");
  }
}

/**
 * OAuth PKCE flow for Proton Drive.
 * Stub — returns placeholder until credentials are configured.
 */
export async function getDriveAccessToken(_clientId: string): Promise<string> {
  return "";
}
