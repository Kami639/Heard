import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "heard",
  description: "A personal archive of every live music experience you've had.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "heard",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            (function(){
              var BUILD = "${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}";
              var reloading = false;
              function reloadOnce(){ if(reloading) return; reloading = true; location.reload(); }

              // iOS freezes a home-screen app instead of reloading it, so
              // returning to the app is the only moment we get to check.
              function checkBuild(){
                fetch("/version.json", { cache: "no-store" })
                  .then(function(r){ return r.json(); })
                  .then(function(d){ if(d && d.buildId && BUILD !== "dev" && d.buildId !== BUILD) reloadOnce(); })
                  .catch(function(){});
                if ("serviceWorker" in navigator) {
                  navigator.serviceWorker.getRegistration().then(function(reg){ if(reg) reg.update(); }).catch(function(){});
                }
              }

              document.addEventListener("visibilitychange", function(){
                if (document.visibilityState === "visible") checkBuild();
              });
              window.addEventListener("pageshow", function(){ checkBuild(); });

              if ("serviceWorker" in navigator) {
                window.addEventListener("load", function(){
                  navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(function(){});
                });
                navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);
              }
            })();
          `,
          }}
        />
      </body>
    </html>
  );
}
