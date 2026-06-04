import { SiteNav } from "./site-nav";

export function SiteHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#b7832d]/30 bg-[linear-gradient(135deg,rgba(255,252,245,0.96),rgba(239,229,207,0.92))] px-5 py-4 shadow-[0_18px_50px_rgba(60,44,20,0.16)]">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-full border-2 border-[#a94435]/70 bg-[#a94435] text-2xl font-extrabold text-[#fffaf0]">
          仙
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase text-[#b7832d]">武侠修仙 RPG</p>
          <h1 className="text-2xl font-bold leading-tight md:text-3xl">仙凡录数值平衡评估器</h1>
        </div>
      </div>
      <SiteNav />
    </header>
  );
}
