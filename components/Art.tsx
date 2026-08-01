"use client";

interface ArtistRef { name: string; imageUrl?: string | null }

export function Art({
  c1, c2, initials, imageUrl, artists, className = "",
}: {
  c1: string; c2: string; initials: string; imageUrl?: string | null;
  artists?: ArtistRef[]; className?: string;
}) {
  const withPhotos = (artists ?? []).filter((a) => a.imageUrl);
  // two or more real photos -> offset tiles; otherwise use the single cover
  const multi = withPhotos.length >= 2;

  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-lg border border-hairline shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_2px_6px_rgb(30_30_30/0.18)] ${className}`}
      style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}
    >
      {multi ? (
        <>
          {/* two offset photos, diagonal overlap */}
          <Tile a={withPhotos[0]} c1={c1} c2={c2} style={{ top: "6%", left: "6%", zIndex: 1 }} />
          <Tile a={withPhotos[1]} c1={c2} c2={c1} style={{ bottom: "6%", right: "6%", zIndex: 2 }} />
          {(artists?.length ?? 0) > 2 && (
            <span className="absolute bottom-1.5 left-1.5 z-10 rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-accent">
              +{artists!.length - 2}
            </span>
          )}
        </>
      ) : imageUrl ? (
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

function Tile({ a, c1, c2, style }: { a: ArtistRef; c1: string; c2: string; style: React.CSSProperties }) {
  return (
    <div
      className="absolute h-[62%] w-[62%] overflow-hidden rounded-xl border border-black/40 shadow-lg"
      style={style}
    >
      {a.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-display text-2xl font-extrabold text-paper/85"
          style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}
        >
          {a.name[0]?.toUpperCase() ?? "?"}
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
