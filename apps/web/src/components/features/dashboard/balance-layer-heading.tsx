type Props = {
  layer: "realm" | "progression";
  title: string;
  description: string;
};

export function BalanceLayerHeading({ layer, title, description }: Props) {
  const accent = layer === "realm" ? "border-[#b7832d]/50" : "border-[#1f7a69]/45";
  return (
    <section className={`rounded-lg border-l-4 ${accent} bg-[rgba(255,250,240,0.45)] px-4 py-3`}>
      <h2 className="text-lg font-bold text-[#252019]">{title}</h2>
      <p className="mt-1 text-sm text-[#6f6559]">{description}</p>
    </section>
  );
}
