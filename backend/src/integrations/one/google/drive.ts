import { passthrough } from "../client.js";

const DRIVE_FILES_LIST_ACTION_ID = "conn_mod_def::GJ6Rzy_a8J8::5DPVGp3fTXegRgMN4v11tA";
// Prerequisite: configure this constant with the WithOne action that supports POST /drive/v3/files when available.
// Using the files collection endpoint shape here; the action must support POST /drive/v3/files.
const DRIVE_FOLDER_CREATE_ACTION_ID = DRIVE_FILES_LIST_ACTION_ID;

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface ListSpreadsheetsInFolderResponse {
  files: DriveSpreadsheetFile[];
  nextPageToken?: string;
}

interface DriveFileCandidate {
  id?: unknown;
  name?: unknown;
  modifiedTime?: unknown;
}

interface DriveFilesListResponse {
  files?: DriveFileCandidate[];
  nextPageToken?: unknown;
}

interface DriveFolderCreateResponse {
  id?: unknown;
  webViewLink?: unknown;
}

export class DriveFolderCreateError extends Error {
  readonly provider = "withone";
  readonly endpoint = "/drive/v3/files";
  readonly actionId = DRIVE_FOLDER_CREATE_ACTION_ID;

  constructor(message: string) {
    super(message);
    this.name = "DriveFolderCreateError";
  }
}

function toSpreadsheetFile(file: DriveFileCandidate): DriveSpreadsheetFile | null {
  if (typeof file.id !== "string" || typeof file.name !== "string") {
    return null;
  }

  return {
    id: file.id,
    name: file.name,
    modifiedTime: typeof file.modifiedTime === "string" ? file.modifiedTime : undefined,
  };
}

export async function listSpreadsheetsInFolder(
  connectionKey: string,
  folderId: string,
): Promise<ListSpreadsheetsInFolderResponse> {
  const data = await passthrough<DriveFilesListResponse>({
    connectionKey,
    actionId: DRIVE_FILES_LIST_ACTION_ID,
    method: "GET",
    path: "/drive/v3/files",
    query: {
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: "nextPageToken,files(id,name,modifiedTime,owners(emailAddress))",
      pageSize: 100,
      orderBy: "modifiedTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    },
  });

  return {
    files: (data.files ?? []).map(toSpreadsheetFile).filter((file): file is DriveSpreadsheetFile => file !== null),
    nextPageToken: typeof data.nextPageToken === "string" ? data.nextPageToken : undefined,
  };
}

export async function createFolder(
  connectionKey: string,
  folderName: string,
  parentFolderId?: string,
): Promise<{ id: string; webViewLink: string }> {
  const data = await passthrough<DriveFolderCreateResponse>({
    connectionKey,
    actionId: DRIVE_FOLDER_CREATE_ACTION_ID,
    method: "POST",
    path: "/drive/v3/files",
    query: {
      fields: "id,webViewLink",
      supportsAllDrives: "true",
    },
    body: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
  });

  if (typeof data.id !== "string" || typeof data.webViewLink !== "string") {
    throw new DriveFolderCreateError(
      `WithOne Drive folder create returned malformed result for /drive/v3/files: expected id and webViewLink strings`,
    );
  }

  return { id: data.id, webViewLink: data.webViewLink };
}
