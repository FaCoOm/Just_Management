import { passthrough } from "../client.js";

const DRIVE_FILES_LIST_ACTION_ID = "conn_mod_def::GJ6Rzy_a8J8::5DPVGp3fTXegRgMN4v11tA";

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
