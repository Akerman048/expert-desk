import Link from "next/link";

import { ArchiveTable } from "@/components/archive/ArchiveTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ArchivePage, ArchiveQuery } from "@/types/archive";
import { Pagination } from "@/components/search/Pagination";
import { PageSizeSelect } from "@/components/search/PageSizeSelect";
import { firstQueryValue } from "@/lib/query-params";

export function ArchiveView({
  result,
  query,
  baseHref,
  clearHref = baseHref,
}: {
  result: ArchivePage;
  query: ArchiveQuery;
  baseHref: string;
  clearHref?: string;
}) {
  const search = firstQueryValue(query.search);
  const archivedBy = firstQueryValue(query.archivedBy);
  const archivedFrom = firstQueryValue(query.archivedFrom);
  const archivedTo = firstQueryValue(query.archivedTo);
  const previousStatus = firstQueryValue(query.previousStatus);

  return (
    <div className="flex flex-col gap-5">
      <form className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label htmlFor="archive-search" className="sr-only">Пошук в архіві</label>
        <Input id="archive-search" name="search" defaultValue={search} placeholder="Назва, адреса, документ…" className="lg:col-span-2" />
        <label htmlFor="archive-actor" className="sr-only">Хто архівував</label>
        <Input id="archive-actor" name="archivedBy" defaultValue={archivedBy} placeholder="Хто архівував" />
        <Input name="archivedFrom" defaultValue={archivedFrom} type="date" aria-label="Архівовано від" />
        <Input name="archivedTo" defaultValue={archivedTo} type="date" aria-label="Архівовано до" />
        <label htmlFor="archive-previous-status" className="sr-only">Попередній статус</label>
        <select
          id="archive-previous-status"
          name="previousStatus"
          defaultValue={previousStatus ?? ""}
          className="h-11 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-base sm:text-sm"
        >
          <option value="">Попередній статус</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RETURNED">RETURNED</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
        <label htmlFor="archive-page-size" className="sr-only">Кількість на сторінці</label>
        <select
          id="archive-page-size"
          name="pageSize"
          defaultValue={String(result.pageSize)}
          className="h-11 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-base sm:text-sm"
        >
          <option value="10">10 на сторінці</option>
          <option value="20">20 на сторінці</option>
          <option value="50">50 на сторінці</option>
        </select>
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row lg:col-span-5 lg:justify-end">
          <Button type="submit" className="w-full sm:w-auto">Застосувати</Button>
          <Button asChild type="button" variant="secondary" className="w-full sm:w-auto">
            <Link href={clearHref}>Очистити</Link>
          </Button>
        </div>
      </form>

      <ArchiveTable projects={result.projects} baseHref={baseHref} />

      <div className="flex justify-stretch sm:justify-end"><PageSizeSelect value={result.pageSize} /></div>
      <Pagination pagination={{ page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages, hasNextPage: result.page < result.totalPages, hasPreviousPage: result.page > 1 }} />
    </div>
  );
}
