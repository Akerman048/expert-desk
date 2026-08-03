import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(relativePath, "utf8");
}

function dashboardTsxFiles(directory = "app/dashboard"): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return dashboardTsxFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [entryPath] : [];
  });
}

describe("authenticated dashboard application shell", () => {
  it("constrains the desktop shell to the dynamic viewport", () => {
    const layout = read("components/layout/DashboardLayout.tsx");

    expect(layout).toContain("min-h-dvh");
    expect(layout).toContain("lg:h-dvh");
    expect(layout).toContain("lg:overflow-hidden");
    for (const utility of ["hidden", "h-full", "shrink-0", "lg:block"]) {
      expect(layout).toContain(utility);
    }
  });

  it("makes only the desktop content panel vertically scrollable", () => {
    const layout = read("components/layout/DashboardLayout.tsx");

    expect(layout).toContain("lg:min-h-0");
    expect(layout).toContain("lg:overflow-y-auto");
    expect(layout).toContain("overflow-x-hidden");
  });

  it("keeps the sidebar full-height with a scrollable navigation region", () => {
    const sidebar = read("components/layout/Sidebar.tsx");
    const navigation = read("components/layout/SidebarNav.tsx");

    for (const utility of [
      "h-full",
      "w-[248px]",
      "overflow-hidden",
      "mt-auto",
      "shrink-0",
    ]) {
      expect(sidebar).toContain(utility);
    }
    expect(navigation).toContain("min-h-0");
    expect(navigation).toContain("overflow-y-auto");
  });

  it("preserves mutually exclusive desktop and mobile navigation", () => {
    const layout = read("components/layout/DashboardLayout.tsx");
    const mobileSidebar = read("components/layout/MobileSidebar.tsx");

    for (const utility of ["hidden", "h-full", "shrink-0", "lg:block"]) {
      expect(layout).toContain(utility);
    }
    expect(mobileSidebar).toContain("lg:hidden");
    expect(mobileSidebar).toContain("h-[100dvh]");
  });

  it("has no nested screen-height utilities in dashboard pages", () => {
    const conflicts = dashboardTsxFiles().filter((file) => {
      const source = read(file);
      return /(?:min-h-screen|h-screen)/.test(source);
    });

    expect(conflicts).toEqual([]);
  });
});
