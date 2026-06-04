import { getHeroEditorData } from "@/actions/hero";
import { AptitudePanel } from "./aptitude-panel";
import { HeroStatsPanel } from "./hero-stats-panel";

export async function HeroEditorSection() {
  const data = await getHeroEditorData();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <HeroStatsPanel initial={data} />
      <AptitudePanel initial={data} />
    </div>
  );
}
