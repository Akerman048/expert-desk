import Image from "next/image";
import { FiLogOut } from "react-icons/fi";

import { SidebarNav } from "./SidebarNav";

import type { UserRole } from "@/app/generated/prisma/client";
import { logout } from "@/app/dashboard/actions";
import { getUserRoleLabel } from "@/lib/user-role";

export type DashboardRole =
  | "head"
  | "expert"
  | "designer"
  | "archivist"
  | "client";

type SidebarProps = {
  role: DashboardRole;
  unreadNotificationCount: number;
  openCommentThreadCount: number;
  archiveCount: number;
  mobile?: boolean;
  onNavigate?: () => void;
  user: {
    name?: string | null;
    email?: string | null;
    role: UserRole;
  };
};

const dashboardRoleByUserRole: Partial<Record<UserRole, DashboardRole>> = {
  HEAD: "head",
  EXPERT: "expert",
  DESIGNER: "designer",
  ARCHIVIST: "archivist",
  CLIENT: "client",
};

export function getDashboardRole(role: UserRole) {
  return dashboardRoleByUserRole[role] ?? null;
}

function getInitials(name: string | null | undefined) {
  if (!name) {
    return "?";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Sidebar({
  role,
  user,
  unreadNotificationCount,
  openCommentThreadCount,
  archiveCount,
  mobile = false,
  onNavigate,
}: SidebarProps) {
  const initials = getInitials(user.name);

  return (
    <aside
      className={`flex min-h-0 shrink-0 flex-col bg-[var(--color-sidebar)] px-3 pb-5 ${
        mobile ? "min-h-full w-full pt-[84px]" : "h-full w-[248px] overflow-hidden pt-5"
      }`}
    >
      <div className="mb-4 shrink-0 border-b border-white/10 px-3 pb-5">
        <div className="relative h-14 w-full overflow-hidden rounded-[var(--radius-md)]">
          <Image
            src="/maibud-logo.png"
            alt="МайБуд — Будуємо порядок."
            width={600}
            height={168}
            priority
            unoptimized
            className="h-full w-full object-contain"
          />
        </div>
      </div>

      <SidebarNav
        role={role}
        unreadNotificationCount={unreadNotificationCount}
        openCommentThreadCount={openCommentThreadCount}
        archiveCount={archiveCount}
        onNavigate={onNavigate}
      />

      <div className="mt-auto flex shrink-0 items-center gap-2.5 rounded-[10px] bg-white/5 p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-slate-200">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">
            {user.name ?? "Користувач"}
          </div>

          <div className="truncate text-[12.5px] text-[var(--color-text-muted)]">
            {user.email ?? "Email не вказано"}
          </div>

          <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
            {getUserRoleLabel(user.role)}
          </div>
        </div>
      </div>

      <form action={logout} className="mt-2 shrink-0">
        <button
          type="submit"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <FiLogOut className="size-4" />
          Вийти
        </button>
      </form>
    </aside>
  );
}
