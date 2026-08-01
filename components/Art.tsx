"use client";

export function Art({
  c1, c2, initials, imageUrl, className = "",
}: { c1: string; c2: string; initials: string; imageUrl?: string | null; className?: string }) {
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-lg border border-hairline shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_2px_6px_rgb(30_30_30/0.18)] ${className}`}
      style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover contrast-105 saturate-[0.9]" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-display text-4xl font-extrabold text-paper/85">
          {initials}
        </span>
      )}
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="tracking-[2px] text-accent" aria-label={`${n} out of 5 stars`}>
      {"★".repeat(n)}
      <span className="text-hairline">{"★".repeat(5 - n)}</span>
    </span>
  );
}
