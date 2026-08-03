import Link from "next/link";

import { ArchiveFileManager } from "@/components/archive/ArchiveFileManager";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { firstQueryValue } from "@/lib/query-params";
import type { ArchiveFilePage, ArchiveFileQuery } from "@/types/archive-file";

export function ArchiveFilesView({ result, query, clearHref }: {
  result: ArchiveFilePage;
  query: ArchiveFileQuery;
  clearHref: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <form className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input type="hidden" name="tab" value="files" />
        <label htmlFor="archive-file-search" className="sr-only">Пошук файлів</label>
        <Input id="archive-file-search" name="fileSearch" defaultValue={firstQueryValue(query.fileSearch)} placeholder="Назва файлу…" className="lg:col-span-2" />
        <label htmlFor="archive-file-uploader" className="sr-only">Завантажив</label>
        <select id="archive-file-uploader" name="fileUploaderId" defaultValue={firstQueryValue(query.fileUploaderId) ?? ""} className="h-11 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-base sm:text-sm">
          <option value="">Усі автори</option>
          {result.uploaders.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
        <label htmlFor="archive-file-project" className="sr-only">Проєкт</label>
        <select id="archive-file-project" name="fileProjectId" defaultValue={firstQueryValue(query.fileProjectId) ?? ""} className="h-11 min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-base sm:text-sm">
          <option value="">Усі проєкти</option>
          {result.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <Input type="date" name="fileFrom" defaultValue={firstQueryValue(query.fileFrom)} aria-label="Додано від" />
        <Input type="date" name="fileTo" defaultValue={firstQueryValue(query.fileTo)} aria-label="Додано до" />
        <input type="hidden" name="filePageSize" value={result.pageSize} />
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row lg:col-span-6 lg:justify-end">
          <Button type="submit" className="w-full sm:w-auto">Застосувати</Button>
          <Button asChild type="button" variant="secondary" className="w-full sm:w-auto"><Link href={clearHref}>Очистити</Link></Button>
        </div>
      </form>
      <ArchiveFileManager result={result} />
    </div>
  );
}
