import { getArchiveProjects } from "@/lib/archive";
import { ArchiveView } from "@/components/archive/ArchiveView";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Header } from "@/components/layout/Header";
import { UserRole } from "@/app/generated/prisma/client";
import { requireRole } from "@/lib/auth-guard";
import type { ArchiveQuery } from "@/types/archive";
import type { ArchiveFileQuery } from "@/types/archive-file";
import { ArchiveTabs } from "@/components/archive/ArchiveTabs";
import { ArchiveFilesView } from "@/components/archive/ArchiveFilesView";
import { getArchiveFiles } from "@/lib/archive-files";
import { firstQueryValue } from "@/lib/query-params";

export default async function HeadArchivePage({
  searchParams,
}: {
  searchParams: Promise<ArchiveQuery & ArchiveFileQuery>;
}) {
  const [currentUser, query] = await Promise.all([
    requireRole([UserRole.HEAD]),
    searchParams,
  ]);
  const activeTab = firstQueryValue(query.tab) === "files" ? "files" : "projects";
  const result = activeTab === "files"
    ? await getArchiveFiles(query)
    : await getArchiveProjects(currentUser.id, currentUser.role, query);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-[22px]">
        <Header
          title="Архів"
          subtitle={activeTab === "files" ? `${result.total} файлів` : `${result.total} архівні справи`}
        />

        <ArchiveTabs active={activeTab} projectsHref="/dashboard/head/archive" filesHref="/dashboard/head/archive?tab=files" />
        {activeTab === "files" ? (
          <ArchiveFilesView result={result as Awaited<ReturnType<typeof getArchiveFiles>>} query={query} clearHref="/dashboard/head/archive?tab=files" />
        ) : (
          <ArchiveView result={result as Awaited<ReturnType<typeof getArchiveProjects>>} query={query} baseHref="/dashboard/head/archive" />
        )}
      </div>
    </DashboardLayout>
  );
}
