import path from "node:path";

import {
  ARCHIVE_FILE_ALLOWED_MIME_TYPES,
  ARCHIVE_FILE_DESCRIPTION_MAX_LENGTH,
  ARCHIVE_FILE_NAME_MAX_LENGTH,
  ARCHIVE_FILE_ORIGINAL_NAME_MAX_LENGTH,
  getArchiveFileMaxSize,
  normalizeArchiveContentType,
} from "@/lib/archive-file-policy";

export function sanitizeArchiveFileName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase().slice(0, 20);
  const baseName = path
    .basename(fileName, path.extname(fileName))
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f/\\]+/g, "-")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\s-]+|[.\s-]+$/g, "")
    .slice(0, 100);
  return `${baseName || "archive-file"}${extension}`;
}

export function validateArchiveUploadMetadata({
  fileName,
  mimeType,
  fileSize,
}: {
  fileName: unknown;
  mimeType: unknown;
  fileSize: unknown;
}) {
  const normalizedFileName = typeof fileName === "string" ? fileName.trim() : "";
  const normalizedMimeType = normalizeArchiveContentType(
    typeof mimeType === "string" ? mimeType : undefined,
  );
  const normalizedFileSize = Number(fileSize);

  if (!normalizedFileName || normalizedFileName.length > ARCHIVE_FILE_ORIGINAL_NAME_MAX_LENGTH) {
    return { error: "Invalid file name", status: 400 as const };
  }
  if (/[/\\\u0000-\u001f\u007f]/.test(normalizedFileName)) {
    return { error: "Invalid file name", status: 400 as const };
  }
  if (!ARCHIVE_FILE_ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
    return { error: "Unsupported file type", status: 415 as const };
  }
  const maxFileSize = getArchiveFileMaxSize();
  if (
    !Number.isSafeInteger(normalizedFileSize) ||
    normalizedFileSize <= 0 ||
    normalizedFileSize > maxFileSize
  ) {
    return { error: "Invalid file size", status: 413 as const };
  }

  return {
    value: {
      fileName: normalizedFileName,
      mimeType: normalizedMimeType,
      fileSize: normalizedFileSize,
      maxFileSize,
    },
  };
}

export function validateArchiveFileDetails({
  name,
  description,
}: {
  name?: unknown;
  description?: unknown;
}) {
  const normalizedName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  const normalizedDescription =
    typeof description === "string" ? description.trim() : "";
  if (!normalizedName || normalizedName.length > ARCHIVE_FILE_NAME_MAX_LENGTH) {
    return { error: "Invalid display name", status: 400 as const };
  }
  if (normalizedDescription.length > ARCHIVE_FILE_DESCRIPTION_MAX_LENGTH) {
    return { error: "Description is too long", status: 400 as const };
  }
  return {
    value: {
      name: normalizedName,
      description: normalizedDescription || null,
    },
  };
}
