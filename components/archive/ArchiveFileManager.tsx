"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { FiDownload, FiEdit2, FiFilePlus, FiTrash2, FiUploadCloud } from "react-icons/fi";

import { Pagination } from "@/components/search/Pagination";
import { PageSizeSelect } from "@/components/search/PageSizeSelect";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { uploadArchiveFileToS3 } from "@/lib/archive-file-browser-upload";
import type { ArchiveFileItem, ArchiveFilePage, PresignArchiveFileResponse } from "@/types/archive-file";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
}

function typeLabel(mimeType: string) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("word") || mimeType === "application/msword") return "Word";
  if (mimeType.includes("spreadsheet")) return "Excel";
  if (mimeType.startsWith("image/")) return "Зображення";
  if (mimeType.includes("acad")) return "DWG";
  return mimeType;
}

async function apiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export function ArchiveFileManager({ result }: { result: ArchiveFilePage }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<ArchiveFileItem | null>(null);
  const [deleting, setDeleting] = useState<ArchiveFileItem | null>(null);

  function closeUpload() {
    if (busy) return;
    setUploadOpen(false);
    setFile(null);
    setProgress(0);
    setError("");
  }

  function chooseDroppedFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const selected = event.dataTransfer.files[0];
    if (selected) setFile(selected);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("Оберіть файл.");
    setBusy(true);
    setError("");
    setProgress(0);
    const form = new FormData(event.currentTarget);
    try {
      const projectId = String(form.get("projectId") || "") || null;
      const presignResponse = await fetch("/api/archive-files/presign", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSize: file.size, projectId }),
      });
      if (!presignResponse.ok) throw new Error(await apiError(presignResponse, "Не вдалося підготувати завантаження."));
      const presigned = (await presignResponse.json()) as PresignArchiveFileResponse;
      setProgress(10);
      await uploadArchiveFileToS3({
        uploadUrl: presigned.uploadUrl,
        uploadHeaders: presigned.uploadHeaders,
        file,
      });
      setProgress(90);
      const completeResponse = await fetch("/api/archive-files/complete", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          archiveFileId: presigned.uploadId,
          storageKey: presigned.storageKey,
          originalName: file.name,
          name: String(form.get("name") || ""),
          description: String(form.get("description") || ""),
          mimeType: file.type,
          fileSize: file.size,
          projectId,
        }),
      });
      if (!completeResponse.ok) throw new Error(await apiError(completeResponse, "Не вдалося зберегти файл."));
      setProgress(100);
      setNotice("Файл успішно додано до архіву.");
      setUploadOpen(false);
      setFile(null);
      setProgress(0);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не вдалося завантажити файл.");
    } finally {
      setBusy(false);
    }
  }

  async function download(item: ArchiveFileItem) {
    setError("");
    const response = await fetch(`/api/archive-files/${item.id}/download`, { cache: "no-store" });
    if (!response.ok) return setError(await apiError(response, "Не вдалося підготувати завантаження."));
    const { downloadUrl } = (await response.json()) as { downloadUrl: string };
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.rel = "noopener";
    link.click();
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/archive-files/${editing.id}`, {
      method: "PATCH",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), description: form.get("description") }),
    });
    setBusy(false);
    if (!response.ok) return setError(await apiError(response, "Не вдалося оновити файл."));
    setEditing(null);
    setNotice("Дані файлу оновлено.");
    router.refresh();
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/archive-files/${deleting.id}`, { method: "DELETE", cache: "no-store" });
    setBusy(false);
    if (!response.ok) return setError(await apiError(response, "Не вдалося видалити файл."));
    setDeleting(null);
    setNotice("Файл видалено з архіву.");
    router.refresh();
  }

  const actionButtons = (item: ArchiveFileItem) => (
    <div className="flex flex-wrap gap-1">
      <Button type="button" variant="ghost" onClick={() => void download(item)} aria-label={`Завантажити ${item.name}`}><FiDownload className="mr-2 size-4" />Завантажити</Button>
      <Button type="button" variant="ghost" onClick={() => { setError(""); setEditing(item); }} aria-label={`Перейменувати ${item.name}`}><FiEdit2 className="mr-2 size-4" />Перейменувати</Button>
      <Button type="button" variant="ghost" onClick={() => { setError(""); setDeleting(item); }} className="text-red-600 hover:text-red-700" aria-label={`Видалити ${item.name}`}><FiTrash2 className="mr-2 size-4" />Видалити</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold">Файли організації</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">{result.total} файлів</p>
        </div>
        <Button type="button" onClick={() => { setNotice(""); setError(""); setUploadOpen(true); }}><FiFilePlus className="mr-2 size-4" />Додати файл</Button>
      </div>
      {notice ? <p role="status" className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {error && !uploadOpen && !editing && !deleting ? <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {result.files.length === 0 ? (
        <EmptyState title="Файлів не знайдено" description="Додайте файл або змініть пошук і фільтри." />
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {result.files.map((item) => <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4">
              <h3 className="break-words font-semibold">{item.name}</h3>
              <p className="mt-1 break-words text-xs text-[var(--color-text-muted)]">{item.originalName}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-[var(--color-text-muted)]">Тип і розмір</dt><dd>{typeLabel(item.mimeType)} · {formatBytes(item.sizeBytes)}</dd></div>
                <div><dt className="text-[var(--color-text-muted)]">Завантажив</dt><dd>{item.uploadedByName}</dd></div>
                <div><dt className="text-[var(--color-text-muted)]">Проєкт</dt><dd>{item.projectName ?? "—"}</dd></div>
                <div><dt className="text-[var(--color-text-muted)]">Дата</dt><dd>{new Date(item.archivedAt).toLocaleDateString("uk-UA")}</dd></div>
              </dl>
              <div className="mt-3 border-t border-slate-100 pt-2">{actionButtons(item)}</div>
            </article>)}
          </div>
          <div className="hidden overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white md:block">
            <table className="min-w-[1050px] w-full text-left">
              <thead className="bg-slate-50 text-xs uppercase text-[var(--color-text-muted)]"><tr><th className="px-4 py-3">Назва</th><th className="px-4 py-3">Тип</th><th className="px-4 py-3">Розмір</th><th className="px-4 py-3">Завантажив</th><th className="px-4 py-3">Проєкт</th><th className="px-4 py-3">Дата</th><th className="px-4 py-3">Дії</th></tr></thead>
              <tbody>{result.files.map((item) => <tr key={item.id} className="border-t border-slate-100 align-top hover:bg-slate-50"><td className="max-w-60 px-4 py-4"><div className="break-words font-semibold">{item.name}</div><div className="mt-1 break-words text-xs text-[var(--color-text-muted)]">{item.originalName}</div></td><td className="px-4 py-4 text-sm">{typeLabel(item.mimeType)}</td><td className="px-4 py-4 text-sm">{formatBytes(item.sizeBytes)}</td><td className="px-4 py-4 text-sm">{item.uploadedByName}</td><td className="px-4 py-4 text-sm">{item.projectName ?? "—"}</td><td className="px-4 py-4 text-sm">{new Date(item.archivedAt).toLocaleDateString("uk-UA")}</td><td className="px-2 py-2">{actionButtons(item)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex justify-end"><PageSizeSelect value={result.pageSize} pageParam="filePage" pageSizeParam="filePageSize" /></div>
          <Pagination pageParam="filePage" pagination={{ page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages, hasNextPage: result.page < result.totalPages, hasPreviousPage: result.page > 1 }} />
        </>
      )}

      {uploadOpen ? <Modal title="Додати файл" description="Файл буде збережено у приватному архіві організації." onClose={closeUpload}>
        <form onSubmit={upload} className="flex flex-col gap-4">
          <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={chooseDroppedFile} className={`rounded-lg border-2 border-dashed p-5 text-center ${dragging ? "border-[var(--color-accent)] bg-blue-50" : "border-[var(--color-border-strong)]"}`}>
            <FiUploadCloud className="mx-auto size-8 text-[var(--color-text-muted)]" />
            <p className="mt-2 break-words text-sm">{file ? file.name : "Перетягніть файл сюди або оберіть його"}</p>
            {file ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatBytes(file.size)}</p> : null}
            <Button type="button" variant="secondary" className="mt-3" onClick={() => inputRef.current?.click()} disabled={busy}>Обрати файл</Button>
            <input ref={inputRef} type="file" className="sr-only" accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg,.dwg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </div>
          <label className="flex flex-col gap-2 text-sm font-semibold">Назва (необов’язково)<Input name="name" maxLength={200} placeholder={file?.name ?? "Назва в архіві"} /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Опис (необов’язково)<textarea name="description" maxLength={2000} rows={3} className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-3 py-2 font-normal outline-none focus:border-[var(--color-accent)]" /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Проєкт (необов’язково)<select name="projectId" className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 font-normal"><option value="">Без проєкту</option>{result.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          {busy ? <div><div className="mb-1 flex justify-between text-xs"><span>Завантаження</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[var(--color-accent)] transition-[width]" style={{ width: `${progress}%` }} /></div></div> : null}
          {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={closeUpload} disabled={busy}>Скасувати</Button><Button type="submit" disabled={busy || !file}>{busy ? "Завантаження…" : "Додати файл"}</Button></div>
        </form>
      </Modal> : null}

      {editing ? <Modal title="Перейменувати файл" description={editing.originalName} onClose={() => !busy && setEditing(null)}><form onSubmit={rename} className="flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm font-semibold">Назва<Input name="name" required maxLength={200} defaultValue={editing.name} /></label><label className="flex flex-col gap-2 text-sm font-semibold">Опис<textarea name="description" maxLength={2000} rows={4} defaultValue={editing.description ?? ""} className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-3 py-2 font-normal" /></label>{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" disabled={busy} onClick={() => setEditing(null)}>Скасувати</Button><Button type="submit" disabled={busy}>{busy ? "Збереження…" : "Зберегти"}</Button></div></form></Modal> : null}
      {deleting ? <Modal title="Видалити файл" description={`«${deleting.name}» буде приховано з архіву.`} onClose={() => !busy && setDeleting(null)}><div className="flex flex-col gap-4"><p className="text-sm text-[var(--color-text-secondary)]">Ця дія не видаляє об’єкт зі сховища та зберігає аудит.</p>{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Скасувати</Button><Button type="button" disabled={busy} onClick={() => void remove()} className="bg-red-600 hover:bg-red-700">{busy ? "Видалення…" : "Видалити"}</Button></div></div></Modal> : null}
    </div>
  );
}
