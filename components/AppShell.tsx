"use client";

import { StatusBar } from "./StatusBar";
import { TabBar } from "./TabBar";
import { Sidebar } from "./Sidebar";

/**
 * One app, two outfits:
 * - Phone: iOS layout — header, content, bottom tab bar.
 * - Desktop (lg+): macOS window — traffic lights, translucent sidebar,
 *   floating on a dark desktop gradient.
 */
export function AppShell({
  title,
  count,
  children,
}: {
  title?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="lg:flex lg:min-h-screen lg:items-center lg:justify-center lg:bg-[radial-gradient(120%_120%_at_50%_0%,#1b1b22_0%,#000_60%)] lg:p-10">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-paper lg:h-[86vh] lg:min-h-0 lg:w-full lg:max-w-5xl lg:flex-row lg:overflow-hidden lg:rounded-2xl lg:border lg:border-hairline lg:shadow-[0_30px_80px_rgb(0_0_0/0.8)]">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <StatusBar title={title} count={count} />
          <div className="fade-up flex min-h-0 flex-1 flex-col lg:overflow-y-auto">{children}</div>
          <TabBar />
        </div>
      </div>
    </div>
  );
}
