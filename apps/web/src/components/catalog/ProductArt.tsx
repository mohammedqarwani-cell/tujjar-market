const PALETTES: [string, string][] = [
  ["#fbe9cc", "#f0c98a"],
  ["#e9eed8", "#c6d39a"],
  ["#f7e1d7", "#e8b59f"],
  ["#e3edf0", "#b5ced5"],
  ["#f1e5ef", "#d7bcd3"],
  ["#f3ecd6", "#dfcb94"],
];

function pick(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

/** Warm illustrated placeholder shown until the merchant adds a photo. */
export function ProductArt({ icon, seed, className = "" }: { icon: string; seed: string; className?: string }) {
  const [from, to] = pick(seed);
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
    >
      <div className="pattern-arches absolute inset-0 opacity-70" />
      <span className="relative text-5xl drop-shadow-sm sm:text-6xl" aria-hidden>
        {icon}
      </span>
    </div>
  );
}
