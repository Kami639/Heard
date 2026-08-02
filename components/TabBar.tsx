"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, LibraryBig, Plus, Map, User } from "lucide-react";

const TABS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/archive", icon: LibraryBig, label: "Archive" },
  { href: "/add", icon: Plus, label: "Add", center: true },
  { href: "/map", icon: Map, label: "Map" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function TabBar() {
  const router = useRouter();
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-40 mx-auto w-full max-w-md border-t border-hairline bg-paper/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {TABS.map(({ href, icon: Icon, label, center }) => {
          const active = path === href;
          if (center) {
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                aria-label={label}
                className="pressable -mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-black shadow-lg shadow-accent/30"
              >
                <Icon size={28} strokeWidth={2.5} />
              </button>
            );
          }
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`pressable flex flex-col items-center gap-0.5 px-3 py-1 ${active ? "text-accent" : "text-sub"}`}
            >
              <Icon size={24} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
