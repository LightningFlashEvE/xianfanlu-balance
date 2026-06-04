"use client";

import { useCallback, useEffect, useRef } from "react";
import { drawRadarChart } from "@/lib/chart-draw";

type Props = {
  axes: { label: string; value: number }[];
};

export function RadarChart({ axes }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawRadarChart(canvas, axes);
  }, [axes]);

  useEffect(() => {
    redraw();
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redraw]);

  return (
    <div className="relative min-h-[240px] overflow-hidden rounded-lg border border-[#d7c7aa]/80 bg-[linear-gradient(rgba(255,253,247,0.82),rgba(255,253,247,0.82)),repeating-linear-gradient(0deg,transparent_0_35px,rgba(37,32,25,0.05)_35px_36px),repeating-linear-gradient(90deg,transparent_0_52px,rgba(37,32,25,0.05)_52px_53px)]">
      <canvas ref={canvasRef} className="block h-full min-h-[240px] w-full" aria-label="主角属性雷达" />
    </div>
  );
}
