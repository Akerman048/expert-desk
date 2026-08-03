import { ArchiveView } from "@/components/archive/ArchiveView";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { getArchiveProjects } from "@/lib/archive";
import { UserRole } from "@/app/generated/prisma/client";
import { requireRole } from "@/lib/auth-guard";
import type { ArchiveQuery } from "@/types/archive";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DashboardDateRangeFilter } from "@/components/dashboard/DashboardDateRangeFilter";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { getArchivistDashboardData } from "@/lib/dashboard/archivist-dashboard";
import { parseDashboardDateRange } from "@/lib/dashboard-date-range";
import type { ArchiveFileQuery } from "@/types/archive-file";
import { firstQueryValue } from "@/lib/query-params";
import { getArchiveFiles } from "@/lib/archive-files";
import { ArchiveTabs } from "@/components/archive/ArchiveTabs";
import { ArchiveFilesView } from "@/components/archive/ArchiveFilesView";

export default async function ArchivistPage({
  searchParams,
}: {
  searchParams: Promise<ArchiveQuery & ArchiveFileQuery>;
}) {
  const [currentUser, query] = await Promise.all([
    requireRole([UserRole.ARCHIVIST]),
    searchParams,
  ]);
  const range = parseDashboardDateRange(query.range);
  const activeTab = firstQueryValue(query.tab) === "files" ? "files" : "projects";
  const [result, dashboard] = await Promise.all([
    activeTab === "files"
      ? getArchiveFiles(query)
      : getArchiveProjects(currentUser.id, currentUser.role, query),
    getArchivistDashboardData(currentUser.id, range),
  ]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-[22px]">
        <Header
          title="Архів"
          subtitle="Документи, справи та комплектність архіву"
        />

        <section aria-labelledby="dashboard-overview-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="dashboard-overview-title" className="text-lg font-semibold text-[var(--color-text-primary)]">Огляд</h2>
            <DashboardDateRangeFilter value={range} />
          </div>
          <DashboardStats stats={dashboard.stats} />
        </section>
        <ActivityFeed activity={dashboard.activity} />

        <ArchiveTabs active={activeTab} projectsHref="/dashboard/archivist" filesHref="/dashboard/archivist?tab=files" />
        {activeTab === "files" ? (
          <ArchiveFilesView result={result as Awaited<ReturnType<typeof getArchiveFiles>>} query={query} clearHref="/dashboard/archivist?tab=files" />
        ) : (
          <ArchiveView result={result as Awaited<ReturnType<typeof getArchiveProjects>>} query={query} baseHref="/dashboard/archivist/archive" clearHref="/dashboard/archivist" />
        )}
      </div>
    </DashboardLayout>
  );
}
