import type { UserRole } from "@/app/generated/prisma/client";

export const ARCHIVE_FILE_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "application/acad",
  "application/x-acad",
  "application/autocad_dwg",
]);

export const ARCHIVE_FILE_DEFAULT_MAX_SIZE = 25 * 1024 * 1024;
export const ARCHIVE_FILE_NAME_MAX_LENGTH = 200;
export const ARCHIVE_FILE_ORIGINAL_NAME_MAX_LENGTH = 255;
export const ARCHIVE_FILE_DESCRIPTION_MAX_LENGTH = 2000;

export function canManageStandaloneArchiveFiles(role: UserRole) {
  return role === "HEAD" || role === "ARCHIVIST";
}

export function normalizeArchiveContentType(value: string | undefined) {
  return value?.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function getArchiveFileMaxSize() {
  const configured = Number(process.env.MAX_DOCUMENT_FILE_SIZE);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : ARCHIVE_FILE_DEFAULT_MAX_SIZE;
}

export function isArchiveStorageKey({
  storageKey,
  organizationId,
  archiveFileId,
}: {
  storageKey: string;
  organizationId: string;
  archiveFileId: string;
}) {
  const prefix = `organizations/${organizationId}/archive/${archiveFileId}/`;
  const remainder = storageKey.slice(prefix.length);
  return (
    storageKey.startsWith(prefix) &&
    remainder.length > 0 &&
    !remainder.includes("/") &&
    !storageKey.includes("..") &&
    !storageKey.includes("\\")
  );
}
