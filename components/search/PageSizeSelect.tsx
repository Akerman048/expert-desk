"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";

export function PageSizeSelect({ value, pageParam = "page", pageSizeParam = "pageSize" }: { value: number; pageParam?: string; pageSizeParam?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <label className="grid min-w-0 grid-cols-[auto_80px] items-center gap-2 text-sm">На сторінці<Select className="!w-20 min-w-0" aria-label="Кількість на сторінці" value={String(value)} options={[10, 20, 50].map((size) => ({ value: String(size), label: String(size) }))} onChange={(event) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(pageSizeParam, event.target.value); params.set(pageParam, "1");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }} /></label>;
}
