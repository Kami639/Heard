"use client";

export function StatusBar({ count, title }: { count?: number; title?: string }) {
  return (
    <header className="sticky top-0 z-40 flex items-baseline justify-between border-b border-transparent bg-paper/80 px-5 pb-2 pt-4 backdrop-blur-xl lg:border-hairline lg:py-3">
      <span className="font-display text-3xl font-bold lowercase tracking-tight text-accent lg:text-xl">
        {title ?? "heard"}
      </span>
      {count !== undefined && (
        <span className="font-mono text-xs text-sub">{count} memories</span>
      )}
    </header>
  );
}
