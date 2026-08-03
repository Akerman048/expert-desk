import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import { getAuthorizationErrorResponse } from "@/lib/api-error";
import { withApiObservability } from "@/lib/api-observability";
import { requireArchiveFileContext } from "@/lib/archive-file-access";
import { isArchiveStorageKey } from "@/lib/archive-file-policy";
import { normalizeError } from "@/lib/error-normalization";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { s3 } from "@/lib/s3";

const DOWNLOAD_URL_EXPIRES_IN = 5 * 60;
const NO_STORE = { "cache-control": "no-store" };
type RouteContext = { params: Promise<{ id: string }> };

async function getArchiveFileDownload(_request: Request, context: RouteContext) {
  try {
    const { organizationId } = await requireArchiveFileContext();
    const { id } = await context.params;
    const file = await prisma.archiveFile.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true, storageKey: true, originalName: true, mimeType: true },
    });
    if (!file) {
      return NextResponse.json({ error: "Archive file not found" }, { status: 404, headers: NO_STORE });
    }
    if (!isArchiveStorageKey({ storageKey: file.storageKey, organizationId, archiveFileId: file.id })) {
      logger.error("Archive file has invalid storage namespace", { archiveFileId: file.id });
      return NextResponse.json({ error: "Archive file is unavailable" }, { status: 409, headers: NO_STORE });
    }
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) throw new Error("AWS_S3_BUCKET is not configured");
    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: file.storageKey,
        ResponseContentType: file.mimeType,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      }),
      { expiresIn: DOWNLOAD_URL_EXPIRES_IN },
    );
    return NextResponse.json({ downloadUrl, expiresIn: DOWNLOAD_URL_EXPIRES_IN }, { headers: NO_STORE });
  } catch (error) {
    const authorizationResponse = getAuthorizationErrorResponse(error);
    if (authorizationResponse) {
      authorizationResponse.headers.set("cache-control", "no-store");
      return authorizationResponse;
    }
    logger.error("Get archive file download URL failed", { error: normalizeError(error) });
    return NextResponse.json({ error: "Could not prepare download" }, { status: 500, headers: NO_STORE });
  }
}

export const GET = withApiObservability("/api/archive-files/[id]/download", getArchiveFileDownload);
