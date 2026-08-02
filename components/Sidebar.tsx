"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, LibraryBig, Music2, Map, Disc3, User, Plus, Trophy, Images, ListOrdered } from "lucide-react";

const ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/archive", icon: LibraryBig, label: "Archive" },
  { href: "/songs", icon: Music2, label: "Songs Heard" },
  { href: "/map", icon: Map, label: "Map" },
  { href: "/wrapped", icon: Disc3, label: "Wrapped" },
  { href: "/gallery", icon: Images, label: "Gallery" },
  { href: "/lists", icon: ListOrdered, label: "Lists" },
  { href: "/achievements", icon: Trophy, label: "Achievements" },
  { href: "/profile", icon: User, label: "Profile" },
];

/** macOS-style translucent sidebar with traffic lights. Desktop only. */
export function Sidebar() {
  const router = useRouter();
  const path = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-hairline bg-card/40 backdrop-blur-2xl lg:flex">
      <div className="flex gap-2 px-4 pb-6 pt-4">
        <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
        <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
        <span className="h-3 w-3 rounded-full bg-[#28C840]" />
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {ITEMS.map(({ href, icon: Icon, label }) => {
          const active = path === href || (href !== "/" && path.startsWith(href));
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={`pressable flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                active ? "bg-accent/15 font-medium text-accent" : "text-ink hover:bg-card"
              }`}
            >
              <Icon size={17} className={active ? "text-accent" : "text-sub"} />
              {label}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto p-3">
        <button
          onClick={() => router.push("/add")}
          className="pressable flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-black"
        >
          <Plus size={17} strokeWidth={2.5} /> Add Concert
        </button>
      </div>
    </aside>
  );
}
