export type ArchiveFileItem = {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  description: string | null;
  archivedAt: string;
  uploadedById: string;
  uploadedByName: string;
  projectId: string | null;
  projectName: string | null;
};

export type ArchiveFilePage = {
  files: ArchiveFileItem[];
  total: number;
  page: number;
  pageSize: 10 | 20 | 50;
  totalPages: number;
  projects: Array<{ id: string; name: string }>;
  uploaders: Array<{ id: string; name: string }>;
};

export type ArchiveFileQuery = {
  tab?: string | string[];
  filePage?: string | string[];
  filePageSize?: string | string[];
  fileSearch?: string | string[];
  fileUploaderId?: string | string[];
  fileProjectId?: string | string[];
  fileFrom?: string | string[];
  fileTo?: string | string[];
};

export type PresignArchiveFileRequest = {
  fileName: string;
  mimeType: string;
  fileSize: number;
  projectId?: string | null;
};

export type PresignArchiveFileResponse = {
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  uploadId: string;
  storageKey: string;
  expiresIn: number;
};

export type CompleteArchiveFileRequest = {
  archiveFileId: string;
  storageKey: string;
  originalName: string;
  name?: string;
  description?: string;
  mimeType: string;
  fileSize: number;
  projectId?: string | null;
};
