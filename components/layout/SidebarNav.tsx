"use client";

import {
  FiArchive,
  FiBell,
  FiBriefcase,
  FiFileText,
  FiMessageSquare,
  FiSettings,
  FiUsers,
} from "react-icons/fi";

import type { DashboardRole } from "./Sidebar";
import { SidebarNavItem } from "./SidebarNavItem";

type SidebarNavProps = {
  role: DashboardRole;
  unreadNotificationCount: number;
  openCommentThreadCount: number;
  archiveCount: number;
  onNavigate?: () => void;
};

const navByRole = {
  head: [
    { label: "Проєкти", href: "/dashboard/head", icon: FiBriefcase },
    { label: "Команда", href: "/dashboard/head/members", icon: FiUsers },
    { label: "Експерти", href: "/dashboard/head/experts", icon: FiUsers },
    { label: "Архів", href: "/dashboard/head/archive", icon: FiArchive },
    {
      label: "Сповіщення",
      href: "/dashboard/head/notifications",
      icon: FiBell,
    },
    { label: "Налаштування", href: "/dashboard/head/settings", icon: FiSettings },
  ],

  expert: [
    { label: "Мої проєкти", href: "/dashboard/expert", icon: FiBriefcase },
    {
      label: "Зауваження",
      href: "/dashboard/expert/comments",
      icon: FiMessageSquare,
    },
    { label: "Документи", href: "/dashboard/expert/documents", icon: FiFileText },
    { label: "Сповіщення", href: "/dashboard/expert/notifications", icon: FiBell },
    { label: "Налаштування", href: "/dashboard/expert/settings", icon: FiSettings },
  ],

  designer: [
    { label: "Мої проєкти", href: "/dashboard/designer", icon: FiBriefcase },
    {
      label: "Зауваження",
      href: "/dashboard/designer/comments",
      icon: FiMessageSquare,
    },
    { label: "Документи", href: "/dashboard/designer/documents", icon: FiFileText },
    { label: "Сповіщення", href: "/dashboard/designer/notifications", icon: FiBell },
    {
      label: "Архів",
      href: "/dashboard/designer/archive",
      icon: FiArchive,
    },
    { label: "Налаштування", href: "/dashboard/designer/settings", icon: FiSettings },
  ],

  archivist: [
    { label: "Архів", href: "/dashboard/archivist", icon: FiArchive },
    { label: "Проєкти", href: "/dashboard/archivist/projects", icon: FiBriefcase },
    {
      label: "Сповіщення",
      href: "/dashboard/archivist/notifications",
      icon: FiBell,
    },
    { label: "Налаштування", href: "/dashboard/archivist/settings", icon: FiSettings },
  ],

  client: [
    { label: "Мої проєкти", href: "/dashboard/client", icon: FiBriefcase },
    { label: "Сповіщення", href: "/dashboard/client/notifications", icon: FiBell },
    { label: "Налаштування", href: "/dashboard/client/settings", icon: FiSettings },
  ],
};

export function SidebarNav({
  role,
  unreadNotificationCount,
  openCommentThreadCount,
  archiveCount,
  onNavigate,
}: SidebarNavProps) {
  const navItems = navByRole[role];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
      {navItems.map((item) => (
        <SidebarNavItem
          key={item.href}
          label={item.label}
          href={item.href}
          icon={item.icon}
          onNavigate={onNavigate}
          badge={
            item.label === "Сповіщення"
              ? unreadNotificationCount > 0
                ? unreadNotificationCount > 99
                  ? "99+"
                  : unreadNotificationCount
                : undefined
              : item.label === "Зауваження"
                ? openCommentThreadCount > 0
                  ? openCommentThreadCount > 99
                    ? "99+"
                    : openCommentThreadCount
                  : undefined
              : item.label === "Архів"
                ? archiveCount > 0
                  ? archiveCount > 99
                    ? "99+"
                    : archiveCount
                  : undefined
                : undefined
          }
        />
      ))}
    </div>
  );
}
