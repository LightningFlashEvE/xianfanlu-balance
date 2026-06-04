import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "仙凡录数值平衡评估器",
  description: "武侠修仙 RPG 数值平衡工具",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <div className="mx-auto w-full max-w-[1680px] p-4 md:p-5">
          <SiteHeader />
          <main className="mt-4 grid gap-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
