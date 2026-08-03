import { NextResponse } from "next/server";

import { Prisma } from "@/app/generated/prisma/client";
import { getAuthorizationErrorResponse } from "@/lib/api-error";
import { withApiObservability } from "@/lib/api-observability";
import { requireArchiveFileContext } from "@/lib/archive-file-access";
import { AuthorizationError } from "@/lib/auth-guard";
import { validateArchiveFileDetails } from "@/lib/archive-file-validation";
import { normalizeError } from "@/lib/error-normalization";
import { logger } from "@/lib/logger";
import { getActiveOrganizationMembershipWhere } from "@/lib/organization-membership";
import { prisma } from "@/lib/prisma";

const NO_STORE = { "cache-control": "no-store" };
type RouteContext = { params: Promise<{ id: string }> };

async function updateArchiveFile(request: Request, context: RouteContext) {
  try {
    const { user, organizationId } = await requireArchiveFileContext();
    const { id } = await context.params;
    let body: { name?: unknown; description?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE });
    }
    const details = validateArchiveFileDetails(body);
    if ("error" in details) {
      return NextResponse.json({ error: details.error }, { status: details.status, headers: NO_STORE });
    }
    const result = await prisma.$transaction(async (tx) => {
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
      if (!membership) {
        throw new AuthorizationError("Active organization membership required", 403);
      }
      const existing = await tx.archiveFile.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { projectId: true },
      });
      if (!existing) return null;
      const updated = await tx.archiveFile.updateMany({
        where: { id, organizationId, deletedAt: null },
        data: details.value,
      });
      if (updated.count !== 1) return null;
      await tx.auditLog.create({
        data: {
          action: "Файл архіву перейменовано",
          entityType: "ARCHIVE_FILE",
          entityId: id,
          userId: user.id,
          projectId: existing.projectId,
        },
      });
      return tx.archiveFile.findUnique({
        where: { id },
        select: { id: true, name: true, description: true, updatedAt: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!result) {
      return NextResponse.json({ error: "Archive file not found" }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    const authorizationResponse = getAuthorizationErrorResponse(error);
    if (authorizationResponse) {
      authorizationResponse.headers.set("cache-control", "no-store");
      return authorizationResponse;
    }
    logger.error("Rename archive file failed", { error: normalizeError(error) });
    return NextResponse.json({ error: "Could not update archive file" }, { status: 500, headers: NO_STORE });
  }
}

async function deleteArchiveFile(_request: Request, context: RouteContext) {
  try {
    const { user, organizationId } = await requireArchiveFileContext();
    const { id } = await context.params;
    const result = await prisma.$transaction(async (tx) => {
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
      if (!membership) {
        throw new AuthorizationError("Active organization membership required", 403);
      }
      const existing = await tx.archiveFile.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: { projectId: true },
      });
      if (!existing) return false;
      const deleted = await tx.archiveFile.updateMany({
        where: { id, organizationId, deletedAt: null },
        data: { deletedAt: new Date(), deletedById: user.id },
      });
      if (deleted.count !== 1) return false;
      await tx.auditLog.create({
        data: {
          action: "Файл видалено з архіву організації",
          entityType: "ARCHIVE_FILE",
          entityId: id,
          userId: user.id,
          projectId: existing.projectId,
        },
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!result) {
      return NextResponse.json({ error: "Archive file not found" }, { status: 404, headers: NO_STORE });
    }
    return new Response(null, { status: 204, headers: NO_STORE });
  } catch (error) {
    const authorizationResponse = getAuthorizationErrorResponse(error);
    if (authorizationResponse) {
      authorizationResponse.headers.set("cache-control", "no-store");
      return authorizationResponse;
    }
    logger.error("Delete archive file failed", { error: normalizeError(error) });
    return NextResponse.json({ error: "Could not delete archive file" }, { status: 500, headers: NO_STORE });
  }
}

export const PATCH = withApiObservability("/api/archive-files/[id]", updateArchiveFile);
export const DELETE = withApiObservability("/api/archive-files/[id]", deleteArchiveFile);
