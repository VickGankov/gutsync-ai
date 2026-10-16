// "Add to home screen": a dismissible banner for Home, and a sheet with the right steps per device.
// Chrome/Android installs with one tap; iOS has no API, so we show the Share-menu steps.

import { useState } from "react";
import { Share, MoreVertical, PlusSquare, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isInAppBrowser, getInAppBrowserName } from "@/lib/browser";
import { promptInstall, useInstall } from "@/lib/install";

const DISMISS_KEY = "gutsync_install_dismissed";

function readDismissed(): boolean {
  try { return !!localStorage.getItem(DISMISS_KEY); } catch { return false; }
}

/** Starts the install: native prompt when the browser offers one, otherwise opens the steps sheet. */
export function useInstallAction() {
  const { canPrompt, installed, platform } = useInstall();
  const [sheetOpen, setSheetOpen] = useState(false);
  const start = async () => {
    if (canPrompt) {
      const ok = await promptInstall();
      if (!ok) setSheetOpen(false);
      return;
    }
    setSheetOpen(true);
  };
  return { start, sheetOpen, closeSheet: () => setSheetOpen(false), installed, platform, canPrompt };
}

export function InstallSheet({ open, onClose, platform }: { open: boolean; onClose: () => void; platform: "ios" | "android" | "other" }) {
  if (!open) return null;
  const inApp = isInAppBrowser();
  const system = platform === "ios" ? "Safari" : "Chrome";
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pb-8" onClick={onClose}>
      <div className="bg-card rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-border/50" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-semibold">Add GutSync to your home screen</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        {inApp ? (
          <p className="text-sm text-muted-foreground">
            You're in {getInAppBrowserName()}'s built-in browser, which can't add apps to the home screen. Open this page in {system} first, then come back to this option.
          </p>
        ) : platform === "ios" ? (
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3"><Share className="w-5 h-5 text-primary shrink-0" /><span>Tap the <b>Share</b> button in Safari's toolbar.</span></li>
            <li className="flex gap-3"><PlusSquare className="w-5 h-5 text-primary shrink-0" /><span>Scroll down and tap <b>Add to Home Screen</b>.</span></li>
            <li className="flex gap-3"><Smartphone className="w-5 h-5 text-primary shrink-0" /><span>Tap <b>Add</b>. GutSync now opens full-screen from your home screen.</span></li>
          </ol>
        ) : platform === "android" ? (
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3"><MoreVertical className="w-5 h-5 text-primary shrink-0" /><span>Tap the <b>⋮ menu</b> in Chrome.</span></li>
            <li className="flex gap-3"><PlusSquare className="w-5 h-5 text-primary shrink-0" /><span>Tap <b>Install app</b> (or <b>Add to Home screen</b>).</span></li>
            <li className="flex gap-3"><Smartphone className="w-5 h-5 text-primary shrink-0" /><span>Confirm. GutSync now opens full-screen from your home screen.</span></li>
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            On your phone, open this page in Safari (iPhone) or Chrome (Android), then use the browser's menu to add it to your home screen.
          </p>
        )}
        <Button variant="outline" className="w-full mt-5" onClick={onClose}>Got it</Button>
      </div>
    </div>
  );
}

/** Shown on Home to people on a phone who haven't installed the app. Dismissal is remembered. */
export default function InstallBanner() {
  const { start, sheetOpen, closeSheet, installed, platform, canPrompt } = useInstallAction();
  const [dismissed, setDismissed] = useState(() => readDismissed());
  if (installed || dismissed || (platform === "other" && !canPrompt)) return null;
  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage unavailable */ }
  };
  return (
    <>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
        <Smartphone className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Open GutSync from your home screen</p>
          <p className="text-xs text-muted-foreground">Full-screen, one tap, no browser bar.</p>
        </div>
        <Button size="sm" onClick={start}>Add</Button>
        <button onClick={dismiss} aria-label="Dismiss" className="p-1 text-muted-foreground"><X className="w-4 h-4" /></button>
      </div>
      <InstallSheet open={sheetOpen} onClose={closeSheet} platform={platform} />
    </>
  );
}
