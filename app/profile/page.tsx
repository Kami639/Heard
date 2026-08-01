"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LcdStat } from "@/components/lcd/LcdStat";
import { getConcerts, deleteConcert } from "@/lib/store";
import { deleteMedia } from "@/lib/media";
import { getSupabase } from "@/lib/supabase";
import { publishProfile, unpublishProfile, myCode, friends, removeFriend, fetchProfile, addFriend } from "@/lib/social";
import { useRouter } from "next/navigation";
import { uniqueShowCount, type ConcertRec } from "@/features/concerts/data";

export default function Profile() {
  const router = useRouter();
  const [concerts, setConcerts] = useState<ConcertRec[]>([]);
  const [email, setEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "code">("password");
  const [busy, setBusy] = useState(false);
  const sb = getSupabase();

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setUserEmail(data.session?.user.email ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setUserEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function sendLink() {
    if (!sb || !email.includes("@")) return;
    setAuthMsg("Sending…");
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setAuthMsg("Couldn't send — try again."); return; }
    setCodeSent(true);
    setAuthMsg("Email sent ✉️ Enter the 6-digit code below.");
  }

  /** Password sign-in: the one flow that works everywhere, including an
   *  installed home-screen app (no email round-trip to lose the session in). */
  async function passwordAuth(create: boolean) {
    if (!sb || !email.includes("@") || password.length < 6) {
      setAuthMsg("Enter an email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    const { data, error } = create
      ? await sb.auth.signUp({ email, password })
      : await sb.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) {
      setAuthMsg(
        /already registered/i.test(error.message)
          ? "That email already has an account — use Sign in."
          : /invalid login/i.test(error.message)
          ? "Email or password didn't match."
          : error.message
      );
      return;
    }
    if (create && !data.session) {
      setAuthMsg("Account created — check your email to confirm, then sign in.");
      return;
    }
    setAuthMsg(null);
    setPassword("");
    try {
      const { fullSync } = await import("@/lib/sync");
      fullSync(true);
    } catch {}
  }

  /** Code entry keeps you inside the app. On iOS an installed home-screen app
   *  has its own storage, so a magic link opened in Safari signs in Safari —
   *  not the app. Typing the code signs in right here. */
  async function verifyCode() {
    if (!sb || code.trim().length < 6) return;
    setVerifying(true);
    const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    setVerifying(false);
    if (error) { setAuthMsg("That code didn't work — check it or send a new one."); return; }
    setAuthMsg(null);
    setCodeSent(false);
    setCode("");
    try {
      const { fullSync } = await import("@/lib/sync");
      fullSync(true);
    } catch {}
  }

  function download(name: string, text: string, type: string) {
    const a = document.createElement("a");
    a.download = name;
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportFull() {
    download(
      `heard-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ version: 1, exported: new Date().toISOString(), concerts }, null, 2),
      "application/json"
    );
  }

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Artist", "Tour", "Venue", "City", "Country", "Date", "Rating", "Price", "Songs", "Notes"];
    const rows = concerts.map((c) => [
      c.artist, c.tour, c.venue, c.city, c.country ?? "", c.dateDisplay,
      c.rating, c.price, c.setlist.length, (c.notes ?? "").replace(/\n/g, " "),
    ].map(esc).join(","));
    download(`heard-${new Date().toISOString().slice(0, 10)}.csv`, [head.map(esc).join(","), ...rows].join("\n"), "text/csv");
  }

  function exportArchive() {
    const data = JSON.stringify({
      name: userEmail?.split("@")[0] ?? "Friend",
      concerts: concerts.map(({ id, artist, tour, venue, city, dateDisplay, year, cancelled }) =>
        ({ id, artist, tour, venue, city, dateDisplay, year, cancelled })),
    });
    const a = document.createElement("a");
    a.download = "heard-archive.json";
    a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importArchive(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.concerts)) throw new Error("bad file");
      sessionStorage.setItem("heard.compare", JSON.stringify(data));
      router.push("/compare");
    } catch { alert("That doesn't look like a heard archive file."); }
  }

  const [sys, setSys] = useState<{ name: string; ok: boolean; note: string }[] | null>(null);

  const [recs, setRecs] = useState<{ artist: string; why: string }[] | null>(null);
  const [recsState, setRecsState] = useState<"idle" | "loading" | "off">("idle");

  async function getRecs() {
    setRecsState("loading");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "recs",
          stats: {
            artists: [...new Set(concerts.map((c) => c.artist))].slice(0, 40),
            genres: [...new Set(concerts.flatMap((c) => c.genres ?? []))].slice(0, 10),
            favourites: concerts.filter((c) => c.rating === 5).map((c) => c.artist).slice(0, 10),
            cities: [...new Set(concerts.map((c) => c.city))].slice(0, 6),
          },
        }),
      });
      const d = await res.json();
      const parsed = d.text ? JSON.parse(d.text.replace(/```json|```/g, "").trim()) : null;
      if (Array.isArray(parsed)) { setRecs(parsed.slice(0, 5)); setRecsState("idle"); }
      else setRecsState("off");
    } catch { setRecsState("off"); }
  }

  const [wipeStep, setWipeStep] = useState<0 | 1 | 2>(0);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [friendList, setFriendList] = useState<{ code: string; name: string }[]>([]);
  const [lookup, setLookup] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    setShareCode(myCode());
    setFriendList(friends());
  }, []);

  async function publish() {
    setPublishing(true);
    const name = prompt("Name for your archive?", userEmail?.split("@")[0] ?? "") ?? "";
    const c = await publishProfile(name);
    setPublishing(false);
    if (c) { setShareCode(c); alert(`Published. Share this code: ${c}`); }
    else alert("Sign in first — publishing needs an account.");
  }

  async function openFriend() {
    const c = lookup.trim().toLowerCase();
    if (!c) return;
    const p = await fetchProfile(c);
    if (!p) { alert("No archive found for that code."); return; }
    addFriend(p.code, p.name);
    setFriendList(friends());
    router.push(`/u/${p.code}`);
  }

  async function wipeEverything() {
    const all = getConcerts();
    try {
      // local media first, then cloud copies, then the records themselves
      deleteMedia(all.flatMap((c) => (c.media ?? []).map((m) => m.id)));
      const urls = all.flatMap((c) => (c.media ?? []).map((m) => m.url));
      if (urls.length) {
        const sync = await import("@/lib/sync");
        await sync.removeMediaRemote(urls);
      }
    } catch {}
    for (const c of all) deleteConcert(c.id);
    try {
      localStorage.removeItem("heard.recent.v1");
      localStorage.removeItem("heard.ach.unreleased");
    } catch {}
    setConcerts(getConcerts());
    setWipeStep(0);
    window.dispatchEvent(new Event("heard-sync"));
  }

  async function runDiagnostics() {
    setSys([{ name: "Running checks…", ok: true, note: "" }]);
    const out: { name: string; ok: boolean; note: string }[] = [];
    // Spotify (images)
    try {
      const r = await fetch("/api/artist?name=Drake");
      const d = await r.json();
      if (d.artist?.imageUrl && d.source === "spotify") out.push({ name: "Artist images", ok: true, note: "working (Spotify)" });
      else if (d.artist?.imageUrl) out.push({ name: "Artist images", ok: true, note: `working via ${d.source} backup — Spotify keys ${d.configured ? "failing (rotate them)" : "missing"}` });
      else if (!d.configured) out.push({ name: "Artist images", ok: false, note: "Spotify keys missing AND backups unreachable" });
      else out.push({ name: "Artist images", ok: false, note: "all image sources down — likely temporary" });
    } catch { out.push({ name: "Spotify images", ok: false, note: "unreachable" }); }
    // setlist.fm (search)
    try {
      const r = await fetch("/api/setlist/search?artist=Drake");
      if (r.status === 429) out.push({ name: "setlist.fm search", ok: false, note: "rate limited — wait a minute" });
      else if (!r.ok) out.push({ name: "setlist.fm search", ok: false, note: "API key missing or invalid" });
      else {
        const d = await r.json();
        out.push({ name: "setlist.fm search", ok: true, note: `working (${d.results?.length ?? 0} results)` });
      }
    } catch { out.push({ name: "setlist.fm search", ok: false, note: "unreachable" }); }
    // previews
    try {
      const r = await fetch(`/api/preview?song=${encodeURIComponent("God's Plan")}&artist=Drake`);
      const d = await r.json();
      out.push(d.previewUrl
        ? { name: "Song previews", ok: true, note: "working" }
        : { name: "Song previews", ok: false, note: "no preview returned — catalogs may be throttling" });
    } catch { out.push({ name: "Song previews", ok: false, note: "unreachable" }); }
    // Wikipedia (tours, venues, setlist fallback)
    try {
      const r = await fetch("/api/tour?name=Antagonist%20Tour&artist=Playboi%20Carti");
      const d = await r.json();
      out.push(d.tour
        ? { name: "Wikipedia tours", ok: true, note: `working (${d.tour.dates?.length ?? 0} dates parsed)` }
        : { name: "Wikipedia tours", ok: false, note: d.reason === "http" ? "Wikipedia rejected the request" : (d.reason ?? "no data") });
    } catch { out.push({ name: "Wikipedia tours", ok: false, note: "unreachable" }); }

    // Claude (optional)
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "recs", stats: { artists: ["Drake"], genres: [], favourites: [], cities: [] } }),
      });
      const d = await r.json();
      if (d.configured === false) out.push({ name: "Claude features", ok: false, note: "no API key set (optional)" });
      else if (d.text) out.push({ name: "Claude features", ok: true, note: "working" });
      else out.push({ name: "Claude features", ok: false, note: d.error ?? "no response" });
    } catch { out.push({ name: "Claude features", ok: false, note: "unreachable" }); }
    setSys(out);
  }

  async function signOut() {
    await sb?.auth.signOut();
    setAuthMsg(null);
  }
  useEffect(() => {
    const load = () => setConcerts(getConcerts());
    load();
    window.addEventListener("heard-sync", load);
    return () => window.removeEventListener("heard-sync", load);
  }, []);

  const attended = concerts.filter((c) => !c.cancelled);
  const rows: [string, string][] = [
    ["Appearance", "Dark"],
    ["Storage", `${concerts.length} / 1000 memories`],
    ["Data", "setlist.fm · Spotify"],
    ["Version", "1.0"],
  ];

  return (
    <AppShell title="profile" count={concerts.length}>
      <section className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        {sb && (
          <div className="rounded-2xl bg-card p-4">
            {userEmail ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{userEmail}</p>
                  <p className="text-xs text-accent">Synced across your devices ✓</p>
                </div>
                <button onClick={signOut} className="pressable shrink-0 rounded-full bg-card2 px-4 py-2 text-xs text-sub">
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[15px] font-semibold">Sync your memories</p>
                <p className="text-xs text-sub">Sign in and your concerts follow you to every device.</p>
                <div className="flex gap-2 pb-1">
                  {(["password", "code"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); setAuthMsg(null); }}
                      className={`pressable rounded-full px-3 py-1 text-[11px] ${
                        mode === m ? "bg-accent font-semibold text-black" : "bg-card2 text-sub"
                      }`}
                    >
                      {m === "password" ? "Password" : "Email code"}
                    </button>
                  ))}
                </div>

                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-lg bg-card2 px-3 py-2 text-[15px] text-ink outline-none placeholder:text-sub"
                />

                {mode === "password" ? (
                  <>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && passwordAuth(false)}
                      placeholder="Password"
                      type="password"
                      autoComplete="current-password"
                      className="w-full rounded-lg bg-card2 px-3 py-2 text-[15px] text-ink outline-none placeholder:text-sub"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => passwordAuth(true)}
                        disabled={busy}
                        className="pressable flex-1 rounded-lg bg-card2 py-2 text-sm text-accent disabled:opacity-50"
                      >
                        Create account
                      </button>
                      <button
                        onClick={() => passwordAuth(false)}
                        disabled={busy}
                        className="pressable flex-[1.4] rounded-lg bg-accent py-2 text-sm font-semibold text-black disabled:opacity-50"
                      >
                        {busy ? "…" : "Sign in"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={sendLink}
                      className="pressable w-full rounded-lg bg-accent py-2 text-sm font-semibold text-black"
                    >
                      {codeSent ? "Resend code" : "Send code"}
                    </button>
                    {codeSent && (
                      <div className="flex gap-2">
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                          placeholder="6-digit code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          className="min-w-0 flex-1 rounded-lg bg-card2 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-ink outline-none placeholder:text-sm placeholder:tracking-normal placeholder:text-sub"
                        />
                        <button
                          onClick={verifyCode}
                          disabled={verifying || code.length < 6}
                          className="pressable shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
                        >
                          {verifying ? "…" : "Go"}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {authMsg && <p className="text-xs text-sub">{authMsg}</p>}
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <LcdStat label="Shows" value={uniqueShowCount(concerts)} />
          <LcdStat label="Cities" value={new Set(attended.map((c) => c.city)).size} />
          <LcdStat label="Spent" value={`$${attended.reduce((s, c) => s + c.price, 0)}`} />
          <LcdStat label="Songs heard" value={attended.reduce((s, c) => s + c.setlist.length, 0)} />
        </div>
        <div className="rounded-2xl bg-card p-4">
          <p className="text-[15px] font-semibold">Share your archive</p>
          <p className="pt-1 text-xs text-sub">
            Publish a read-only copy and give friends the code. Nothing is shared until you publish.
          </p>
          {shareCode ? (
            <div className="flex flex-col gap-2 pt-3">
              <div className="flex items-center gap-2 rounded-lg bg-card2 px-3 py-2">
                <span className="flex-1 font-mono text-lg tracking-[0.25em] text-accent">{shareCode}</span>
                <button
                  onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/u/${shareCode}`); alert("Link copied"); }}
                  className="pressable rounded-full bg-card px-3 py-1 text-[11px] text-accent"
                >
                  Copy link
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={publish} disabled={publishing} className="pressable flex-1 rounded-lg bg-card2 py-2 text-xs text-accent disabled:opacity-50">
                  {publishing ? "…" : "Update snapshot"}
                </button>
                <button
                  onClick={async () => { await unpublishProfile(); setShareCode(null); }}
                  className="pressable flex-1 rounded-lg bg-card2 py-2 text-xs text-sub"
                >
                  Unpublish
                </button>
              </div>
            </div>
          ) : (
            <button onClick={publish} disabled={publishing} className="pressable mt-3 w-full rounded-lg bg-accent py-2 text-sm font-bold text-black disabled:opacity-50">
              {publishing ? "Publishing…" : "Publish my archive"}
            </button>
          )}

          <div className="flex gap-2 pt-4">
            <input
              value={lookup}
              onChange={(e) => setLookup(e.target.value.replace(/\s/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && openFriend()}
              placeholder="friend's code"
              className="min-w-0 flex-1 rounded-lg bg-card2 px-3 py-2 font-mono text-sm tracking-widest text-ink outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-sub"
            />
            <button onClick={openFriend} className="pressable shrink-0 rounded-lg bg-card2 px-4 py-2 text-sm text-accent">
              View
            </button>
          </div>

          {friendList.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-3">
              {friendList.map((f) => (
                <span key={f.code} className="flex items-center gap-1.5 rounded-full bg-card2 px-2.5 py-1 text-xs">
                  <button onClick={() => router.push(`/u/${f.code}`)} className="pressable max-w-[120px] truncate">
                    {f.name}
                  </button>
                  <button
                    onClick={() => { removeFriend(f.code); setFriendList(friends()); }}
                    className="pressable text-[10px] text-sub"
                    aria-label={`Remove ${f.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-card p-4">
          <p className="text-[15px] font-semibold">Backup</p>
          <p className="pt-1 text-xs text-sub">Keep a copy of everything — phones lose data, apps get cleared.</p>
          <div className="flex gap-2 pt-3">
            <button onClick={exportFull} className="pressable flex-1 rounded-lg bg-card2 py-2 text-sm text-accent">
              Full backup (JSON)
            </button>
            <button onClick={exportCsv} className="pressable flex-1 rounded-lg bg-card2 py-2 text-sm text-accent">
              Spreadsheet (CSV)
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4">
          <p className="text-[15px] font-semibold">Danger zone</p>
          {wipeStep === 0 && (
            <>
              <p className="pt-1 text-xs text-sub">Delete every concert, photo, video and note — everywhere, including the cloud.</p>
              <button
                onClick={() => setWipeStep(1)}
                disabled={concerts.length === 0}
                className="pressable mt-3 w-full rounded-lg bg-card2 py-2 text-sm text-red-400 disabled:opacity-40"
              >
                Erase my archive
              </button>
            </>
          )}
          {wipeStep === 1 && (
            <>
              <p className="pt-1 text-xs text-sub">
                This wipes <span className="font-semibold text-ink">{concerts.length} shows</span> and all their media. It cannot be undone —
                export a backup from Compare first if you might want it back.
              </p>
              <div className="flex gap-2 pt-3">
                <button onClick={() => setWipeStep(0)} className="pressable flex-1 rounded-lg bg-card2 py-2 text-sm text-accent">
                  Keep my archive
                </button>
                <button onClick={() => setWipeStep(2)} className="pressable flex-1 rounded-lg bg-red-500/20 py-2 text-sm font-semibold text-red-400">
                  Continue
                </button>
              </div>
            </>
          )}
          {wipeStep === 2 && (
            <>
              <p className="pt-1 text-xs text-red-400">Last chance. Erase everything?</p>
              <div className="flex gap-2 pt-3">
                <button onClick={() => setWipeStep(0)} className="pressable flex-[1.5] rounded-lg bg-accent py-2 text-sm font-bold text-black">
                  Cancel
                </button>
                <button onClick={wipeEverything} className="pressable flex-1 rounded-lg bg-red-500 py-2 text-sm font-bold text-white">
                  Erase
                </button>
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-card p-4">
          <p className="text-[15px] font-semibold">Who should you see next?</p>
          <p className="pt-1 text-xs text-sub">Suggestions based on your archive.</p>
          {recs ? (
            <div className="flex flex-col gap-2 pt-3">
              {recs.map((r) => (
                <button
                  key={r.artist}
                  onClick={() => router.push(`/artist/${encodeURIComponent(r.artist)}`)}
                  className="pressable rounded-xl bg-card2 px-3 py-2 text-left"
                >
                  <p className="text-sm font-semibold text-accent">{r.artist}</p>
                  <p className="text-xs text-sub">{r.why}</p>
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={getRecs}
              disabled={recsState === "loading" || concerts.length === 0}
              className="pressable mt-3 w-full rounded-lg bg-card2 py-2 text-sm text-accent disabled:opacity-50"
            >
              {recsState === "loading" ? "Thinking…"
                : recsState === "off" ? "Unavailable — add an API key"
                : "✨ Suggest artists"}
            </button>
          )}
        </div>

        <div className="rounded-2xl bg-card p-4">
          <p className="text-[15px] font-semibold">Compare with a friend</p>
          <p className="pt-1 text-xs text-sub">Trade archive files, see the overlap — shows you were both at, artists you&apos;ve both seen.</p>
          <div className="flex gap-2 pt-3">
            <button onClick={exportArchive} className="pressable flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-black">
              Export mine
            </button>
            <label className="pressable flex flex-1 cursor-pointer items-center justify-center rounded-lg bg-card2 py-2 text-sm text-accent">
              Import theirs
              <input type="file" accept=".json,application/json" hidden onChange={importArchive} />
            </label>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold">System Status</p>
            <button onClick={runDiagnostics} className="pressable rounded-full bg-card2 px-4 py-1.5 text-xs text-accent">
              Run checks
            </button>
          </div>
          {sys && (
            <div className="flex flex-col gap-1.5 pt-3">
              {sys.map((r) => (
                <div key={r.name} className="flex items-baseline gap-2 text-sm">
                  <span>{r.ok ? "🟢" : "🔴"}</span>
                  <span className="shrink-0">{r.name}</span>
                  <span className="min-w-0 flex-1 truncate text-right text-xs text-sub">{r.note}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl bg-card">
          {rows.map(([k, v], i) => (
            <div key={k} className={`flex justify-between px-4 py-3.5 text-[15px] ${i < rows.length - 1 ? "border-b border-hairline" : ""}`}>
              <span>{k}</span>
              <span className="text-sub">{v}</span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
