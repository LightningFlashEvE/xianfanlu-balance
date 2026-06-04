"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "评估器" },
  { href: "/sandbox", label: "对战沙盘" },
  { href: "/sandbox/balance-report", label: "平衡报告" },
  { href: "/manage", label: "数值管理" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : link.href === "/sandbox"
              ? pathname === "/sandbox"
              : pathname.startsWith(link.href);
        return (
          <Button key={link.href} variant={active ? "default" : "outline"} asChild>
            <Link href={link.href} className={cn(active && "pointer-events-none")}>
              {link.label}
            </Link>
          </Button>
        );
      })}
      <Button variant="outline" asChild>
        <a href="/api/export/balance">导出 JSON</a>
      </Button>
    </nav>
  );
}
