import { describe, expect, it } from "vitest";

import { UserRole } from "@/app/generated/prisma/client";
import {
  canManageStandaloneArchiveFiles,
  isArchiveStorageKey,
  normalizeArchiveContentType,
} from "@/lib/archive-file-policy";
import {
  sanitizeArchiveFileName,
  validateArchiveFileDetails,
  validateArchiveUploadMetadata,
} from "@/lib/archive-file-validation";

describe("standalone archive file policy", () => {
  it("allows only HEAD and ARCHIVIST", () => {
    expect(canManageStandaloneArchiveFiles(UserRole.HEAD)).toBe(true);
    expect(canManageStandaloneArchiveFiles(UserRole.ARCHIVIST)).toBe(true);
    expect(canManageStandaloneArchiveFiles(UserRole.EXPERT)).toBe(false);
    expect(canManageStandaloneArchiveFiles(UserRole.DESIGNER)).toBe(false);
    expect(canManageStandaloneArchiveFiles(UserRole.CLIENT)).toBe(false);
  });

  it("accepts only the exact organization archive namespace", () => {
    const valid = "organizations/org-1/archive/file-1/report.pdf";
    expect(isArchiveStorageKey({ storageKey: valid, organizationId: "org-1", archiveFileId: "file-1" })).toBe(true);
    expect(isArchiveStorageKey({ storageKey: valid, organizationId: "org-2", archiveFileId: "file-1" })).toBe(false);
    expect(isArchiveStorageKey({ storageKey: `prefix/${valid}`, organizationId: "org-1", archiveFileId: "file-1" })).toBe(false);
    expect(isArchiveStorageKey({ storageKey: "organizations/org-1/archive/file-10/report.pdf", organizationId: "org-1", archiveFileId: "file-1" })).toBe(false);
    expect(isArchiveStorageKey({ storageKey: `${valid}/extra`, organizationId: "org-1", archiveFileId: "file-1" })).toBe(false);
    expect(isArchiveStorageKey({ storageKey: "organizations/org-1/archive/file-1/../secret.pdf", organizationId: "org-1", archiveFileId: "file-1" })).toBe(false);
    expect(isArchiveStorageKey({ storageKey: "organizations/org-1/archive/file-1/secret\\file.pdf", organizationId: "org-1", archiveFileId: "file-1" })).toBe(false);
  });

  it("normalizes content types and safe storage names", () => {
    expect(normalizeArchiveContentType("Application/PDF; charset=binary")).toBe("application/pdf");
    expect(sanitizeArchiveFileName("Кошторис фінальний.PDF")).toBe("Кошторис-фінальний.pdf");
  });

  it("validates bounded upload metadata", () => {
    expect(validateArchiveUploadMetadata({ fileName: "plan.pdf", mimeType: "application/pdf", fileSize: 100 })).toHaveProperty("value");
    expect(validateArchiveUploadMetadata({ fileName: "plan.exe", mimeType: "application/octet-stream", fileSize: 100 })).toMatchObject({ status: 415 });
    expect(validateArchiveUploadMetadata({ fileName: "../plan.pdf", mimeType: "application/pdf", fileSize: 100 })).toMatchObject({ status: 400 });
    expect(validateArchiveUploadMetadata({ fileName: "plan.pdf", mimeType: "application/pdf", fileSize: 0 })).toMatchObject({ status: 413 });
  });

  it("normalizes display details and rejects oversized values", () => {
    expect(validateArchiveFileDetails({ name: "  План   поверху ", description: "  Опис  " })).toEqual({ value: { name: "План поверху", description: "Опис" } });
    expect(validateArchiveFileDetails({ name: "x".repeat(201), description: "" })).toMatchObject({ status: 400 });
    expect(validateArchiveFileDetails({ name: "План", description: "x".repeat(2001) })).toMatchObject({ status: 400 });
  });
});
