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
            __html: `if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").then(function(reg){
              reg.addEventListener("updatefound",function(){
                var sw=reg.installing;
                if(!sw)return;
                sw.addEventListener("statechange",function(){
                  if(sw.state==="installed"&&navigator.serviceWorker.controller){sw.postMessage("skip-waiting");}
                });
              });
              setInterval(function(){reg.update().catch(function(){});},60000);
            }).catch(function(){});
            var reloading=false;
            navigator.serviceWorker.addEventListener("controllerchange",function(){
              if(reloading)return;reloading=true;window.location.reload();
            });
          })}`,
          }}
        />
      </body>
    </html>
  );
}
