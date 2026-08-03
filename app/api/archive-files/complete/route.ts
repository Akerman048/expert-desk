import { HeadObjectCommand, S3ServiceException } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { Prisma } from "@/app/generated/prisma/client";
import { getAuthorizationErrorResponse } from "@/lib/api-error";
import { withApiObservability } from "@/lib/api-observability";
import { findArchiveProject, requireArchiveFileContext } from "@/lib/archive-file-access";
import { isArchiveStorageKey, normalizeArchiveContentType } from "@/lib/archive-file-policy";
import { validateArchiveFileDetails, validateArchiveUploadMetadata } from "@/lib/archive-file-validation";
import { normalizeError } from "@/lib/error-normalization";
import { logger } from "@/lib/logger";
import { getActiveOrganizationMembershipWhere } from "@/lib/organization-membership";
import { prisma } from "@/lib/prisma";
import { s3 } from "@/lib/s3";
import type { CompleteArchiveFileRequest } from "@/types/archive-file";

const NO_STORE = { "cache-control": "no-store" };

async function completeArchiveFile(request: Request) {
  try {
    const { user, organizationId } = await requireArchiveFileContext();
    let body: CompleteArchiveFileRequest;
    try {
      body = (await request.json()) as CompleteArchiveFileRequest;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE });
    }

    const archiveFileId = body.archiveFileId?.trim();
    const storageKey = body.storageKey?.trim();
    if (!archiveFileId || !storageKey || !isArchiveStorageKey({ storageKey, organizationId, archiveFileId })) {
      return NextResponse.json({ error: "Invalid archive storage key" }, { status: 403, headers: NO_STORE });
    }
    const metadata = validateArchiveUploadMetadata({
      fileName: body.originalName,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
    });
    if ("error" in metadata) {
      return NextResponse.json({ error: metadata.error }, { status: metadata.status, headers: NO_STORE });
    }
    const details = validateArchiveFileDetails({
      name: body.name?.trim() || metadata.value.fileName.slice(0, 200),
      description: body.description,
    });
    if ("error" in details) {
      return NextResponse.json({ error: details.error }, { status: details.status, headers: NO_STORE });
    }
    const projectId = body.projectId?.trim() || null;
    if (projectId && !(await findArchiveProject(organizationId, projectId))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404, headers: NO_STORE });
    }
    if (await prisma.archiveFile.findFirst({ where: { OR: [{ id: archiveFileId }, { storageKey }] }, select: { id: true } })) {
      return NextResponse.json({ error: "Upload has already been completed" }, { status: 409, headers: NO_STORE });
    }

    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) throw new Error("AWS_S3_BUCKET is not configured");
    let object;
    try {
      object = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
    } catch (error) {
      if (error instanceof S3ServiceException && (error.$metadata.httpStatusCode === 404 || error.name === "NotFound" || error.name === "NoSuchKey")) {
        return NextResponse.json({ error: "Uploaded object was not found" }, { status: 404, headers: NO_STORE });
      }
      logger.error("Archive file HeadObject failed", { error: normalizeError(error) });
      return NextResponse.json({ error: "Could not verify uploaded object" }, { status: 502, headers: NO_STORE });
    }
    const actualSize = object.ContentLength;
    const actualMimeType = normalizeArchiveContentType(object.ContentType);
    if (actualSize !== metadata.value.fileSize || actualMimeType !== metadata.value.mimeType) {
      return NextResponse.json({ error: "Uploaded object metadata does not match" }, { status: 409, headers: NO_STORE });
    }

    try {
      const archiveFile = await prisma.$transaction(async (tx) => {
        const membership = await tx.organizationMember.findFirst({
          where: {
            ...getActiveOrganizationMembershipWhere({
              organizationId,
              userId: user.id,
              role: user.role,
            }),
            user: { isActive: true, role: user.role },
          },
          select: { id: true },
        });
        if (!membership) throw new Error("ARCHIVE_MEMBERSHIP_REVOKED");
        if (projectId) {
          const projectExists = await tx.project.count({ where: { id: projectId, organizationId } });
          if (projectExists !== 1) throw new Error("ARCHIVE_PROJECT_CHANGED");
        }
        const created = await tx.archiveFile.create({
          data: {
            id: archiveFileId,
            organizationId,
            uploadedById: user.id,
            projectId,
            name: details.value.name,
            originalName: metadata.value.fileName,
            mimeType: metadata.value.mimeType,
            sizeBytes: actualSize,
            storageKey,
            description: details.value.description,
          },
          select: { id: true, name: true, archivedAt: true },
        });
        await tx.auditLog.create({
          data: {
            action: "Файл додано до архіву організації",
            entityType: "ARCHIVE_FILE",
            entityId: created.id,
            userId: user.id,
            projectId,
          },
        });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return NextResponse.json({ ...archiveFile, archivedAt: archiveFile.archivedAt.toISOString() }, { status: 201, headers: NO_STORE });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
        return NextResponse.json({ error: "Upload has already been completed or access changed" }, { status: 409, headers: NO_STORE });
      }
      if (error instanceof Error && (error.message === "ARCHIVE_MEMBERSHIP_REVOKED" || error.message === "ARCHIVE_PROJECT_CHANGED")) {
        return NextResponse.json({ error: "Access or project changed during upload" }, { status: 409, headers: NO_STORE });
      }
      throw error;
    }
  } catch (error) {
    const authorizationResponse = getAuthorizationErrorResponse(error);
    if (authorizationResponse) {
      authorizationResponse.headers.set("cache-control", "no-store");
      return authorizationResponse;
    }
    logger.error("Complete archive file upload failed", { error: normalizeError(error) });
    return NextResponse.json({ error: "Could not save archive file" }, { status: 500, headers: NO_STORE });
  }
}

export const POST = withApiObservability("/api/archive-files/complete", completeArchiveFile);
