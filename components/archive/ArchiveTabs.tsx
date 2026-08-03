import Link from "next/link";

export function ArchiveTabs({ active, projectsHref, filesHref }: {
  active: "projects" | "files";
  projectsHref: string;
  filesHref: string;
}) {
  return (
    <nav aria-label="Розділи архіву" className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
      <Link
        href={projectsHref}
        aria-current={active === "projects" ? "page" : undefined}
        className={`min-h-11 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${active === "projects" ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
      >
        Архівовані проєкти
      </Link>
      <Link
        href={filesHref}
        aria-current={active === "files" ? "page" : undefined}
        className={`min-h-11 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${active === "files" ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
      >
        Файли
      </Link>
    </nav>
  );
}
