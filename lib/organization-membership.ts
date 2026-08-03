import "server-only";

import type {
  Prisma,
  UserRole,
} from "@/app/generated/prisma/client";

export function getActiveOrganizationMembershipWhere({
  organizationId,
  membershipId,
  userId,
  role,
}: {
  organizationId?: string;
  membershipId?: string;
  userId?: string;
  role?: UserRole;
}): Prisma.OrganizationMemberWhereInput {
  return {
    ...(organizationId ? { organizationId } : {}),
    ...(membershipId ? { id: membershipId } : {}),
    ...(userId ? { userId } : {}),
    ...(role ? { role } : {}),
    removedAt: null,
    user: { isActive: true },
  };
}
