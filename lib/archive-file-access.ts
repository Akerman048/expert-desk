import "server-only";

import { UserRole } from "@/app/generated/prisma/client";
import { AuthorizationError, requireRole } from "@/lib/auth-guard";
import { getActiveOrganizationMembershipWhere } from "@/lib/organization-membership";
import { prisma } from "@/lib/prisma";

export async function requireArchiveFileContext() {
  const user = await requireRole([UserRole.HEAD, UserRole.ARCHIVIST]);
  const memberships = await prisma.organizationMember.findMany({
    where: {
      ...getActiveOrganizationMembershipWhere({
        userId: user.id,
        role: user.role,
      }),
      user: { isActive: true, role: user.role },
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    take: 2,
    select: { organizationId: true },
  });

  if (memberships.length !== 1) {
    throw new AuthorizationError(
      "Exactly one active organization membership is required",
      403,
    );
  }

  return { user, organizationId: memberships[0].organizationId };
}

export async function findArchiveProject(
  organizationId: string,
  projectId: string | null | undefined,
) {
  if (!projectId) return null;
  return prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: { id: true, name: true },
  });
}
