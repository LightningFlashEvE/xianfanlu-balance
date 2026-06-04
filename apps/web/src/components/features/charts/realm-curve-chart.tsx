"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawRealmCurve, type RealmPoint } from "@/lib/chart-draw";

type Props = {
  realms: RealmPoint[];
  heroRealm: string;
};

export function RealmCurveChart({ realms, heroRealm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logScale, setLogScale] = useState(true);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawRealmCurve(canvas, { realms, heroRealm, logScale });
  }, [realms, heroRealm, logScale]);

  useEffect(() => {
    redraw();
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redraw]);

  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-bold text-[#6f6559]">
        <input
          type="checkbox"
          checked={logScale}
          onChange={(e) => setLogScale(e.target.checked)}
          className="accent-[#1f7a69]"
        />
        对数视图
      </label>
      <div className="relative min-h-[310px] overflow-hidden rounded-lg border border-[#d7c7aa]/80 bg-[linear-gradient(rgba(255,253,247,0.82),rgba(255,253,247,0.82)),repeating-linear-gradient(0deg,transparent_0_35px,rgba(37,32,25,0.05)_35px_36px),repeating-linear-gradient(90deg,transparent_0_52px,rgba(37,32,25,0.05)_52px_53px)]">
        <canvas ref={canvasRef} className="block h-[min(460px,50vh)] w-full" aria-label="境界战力曲线" />
      </div>
    </div>
  );
}
