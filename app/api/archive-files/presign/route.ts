import { randomUUID } from "node:crypto";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import { getAuthorizationErrorResponse } from "@/lib/api-error";
import { withApiObservability } from "@/lib/api-observability";
import { findArchiveProject, requireArchiveFileContext } from "@/lib/archive-file-access";
import { createArchiveFilePutObject } from "@/lib/archive-file-presign";
import { sanitizeArchiveFileName, validateArchiveUploadMetadata } from "@/lib/archive-file-validation";
import { normalizeError } from "@/lib/error-normalization";
import { logger } from "@/lib/logger";
import { s3 } from "@/lib/s3";
import type { PresignArchiveFileRequest, PresignArchiveFileResponse } from "@/types/archive-file";

const PRESIGNED_URL_EXPIRES_IN = 5 * 60;
const NO_STORE = { "cache-control": "no-store" };

async function presignArchiveFile(request: Request) {
  try {
    const { organizationId } = await requireArchiveFileContext();
    let body: PresignArchiveFileRequest;
    try {
      body = (await request.json()) as PresignArchiveFileRequest;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE });
    }

    const metadata = validateArchiveUploadMetadata({
      fileName: body.fileName,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
    });
    if ("error" in metadata) {
      return NextResponse.json({ error: metadata.error }, { status: metadata.status, headers: NO_STORE });
    }

    const projectId = body.projectId?.trim() || null;
    if (projectId && !(await findArchiveProject(organizationId, projectId))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404, headers: NO_STORE });
    }
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) throw new Error("AWS_S3_BUCKET is not configured");

    const archiveFileId = randomUUID();
    const storageKey = [
      "organizations",
      organizationId,
      "archive",
      archiveFileId,
      sanitizeArchiveFileName(metadata.value.fileName),
    ].join("/");
    const { command, uploadHeaders } = createArchiveFilePutObject({
      bucket,
      storageKey,
      mimeType: metadata.value.mimeType,
    });
    const uploadUrl = await getSignedUrl(
      s3,
      command,
      { expiresIn: PRESIGNED_URL_EXPIRES_IN },
    );
    const response: PresignArchiveFileResponse = {
      uploadUrl,
      uploadHeaders,
      uploadId: archiveFileId,
      storageKey,
      expiresIn: PRESIGNED_URL_EXPIRES_IN,
    };
    return NextResponse.json(response, { headers: NO_STORE });
  } catch (error) {
    const authorizationResponse = getAuthorizationErrorResponse(error);
    if (authorizationResponse) {
      authorizationResponse.headers.set("cache-control", "no-store");
      return authorizationResponse;
    }
    logger.error("Create archive file presigned URL failed", { error: normalizeError(error) });
    return NextResponse.json({ error: "Could not prepare upload" }, { status: 500, headers: NO_STORE });
  }
}

export const POST = withApiObservability("/api/archive-files/presign", presignArchiveFile);
