import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { requireArchiveFileContext } from "@/lib/archive-file-access";
import { prisma } from "@/lib/prisma";
import {
  firstQueryValue,
  getPaginationMeta,
  normalizeSearchQuery,
  parseDateEndParam,
  parseDateParam,
  parsePage,
  parsePageSize,
} from "@/lib/query-params";
import type { ArchiveFilePage, ArchiveFileQuery } from "@/types/archive-file";

export async function getArchiveFiles(
  query: ArchiveFileQuery,
): Promise<ArchiveFilePage> {
  const { organizationId } = await requireArchiveFileContext();
  const page = parsePage(firstQueryValue(query.filePage));
  const pageSize = parsePageSize(firstQueryValue(query.filePageSize));
  const search = normalizeSearchQuery(firstQueryValue(query.fileSearch));
  const uploaderId = firstQueryValue(query.fileUploaderId)?.trim();
  const projectId = firstQueryValue(query.fileProjectId)?.trim();
  const from = parseDateParam(firstQueryValue(query.fileFrom));
  const to = parseDateEndParam(firstQueryValue(query.fileTo));

  const where: Prisma.ArchiveFileWhereInput = {
    organizationId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { originalName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(uploaderId ? { uploadedById: uploaderId } : {}),
    ...(projectId ? { projectId } : {}),
    ...(from || to
      ? { archivedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  const [total, records, projects, uploaders] = await prisma.$transaction([
    prisma.archiveFile.count({ where }),
    prisma.archiveFile.findMany({
      where,
      orderBy: [{ archivedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        description: true,
        archivedAt: true,
        uploadedById: true,
        uploadedBy: { select: { name: true } },
        projectId: true,
        project: { select: { name: true } },
      },
    }),
    prisma.project.findMany({
      where: { organizationId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: {
        uploadedArchiveFiles: { some: { organizationId, deletedAt: null } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  const pagination = getPaginationMeta({ page, pageSize, total });

  return {
    files: records.map((record) => ({
      id: record.id,
      name: record.name,
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      description: record.description,
      archivedAt: record.archivedAt.toISOString(),
      uploadedById: record.uploadedById,
      uploadedByName: record.uploadedBy.name,
      projectId: record.projectId,
      projectName: record.project?.name ?? null,
    })),
    total,
    page: pagination.page,
    pageSize,
    totalPages: pagination.totalPages,
    projects,
    uploaders,
  };
}
