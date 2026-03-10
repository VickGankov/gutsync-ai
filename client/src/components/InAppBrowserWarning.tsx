/**
 * InAppBrowserWarning
 * Shown when the user is inside an in-app browser (Facebook, Messenger, Instagram, etc.)
 * and tries to sign in. Google blocks OAuth in these environments.
 */
import { ExternalLink, AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInAppBrowserName } from "@/lib/browser";
import { toast } from "sonner";

interface Props {
  loginUrl: string;
  onDismiss: () => void;
}

export default function InAppBrowserWarning({ loginUrl, onDismiss }: Props) {
  const browserName = getInAppBrowserName();

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const systemBrowserName = isIOS ? "Safari" : "Chrome";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success("Link copied! Paste it in " + systemBrowserName);
    }).catch(() => {
      toast.error("Couldn't copy — please copy the link manually from your address bar");
    });
  };

  const handleOpenInBrowser = () => {
    // Try to open in system browser
    window.open(window.location.href, "_system") || window.open(window.location.href, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-8">
      <div className="bg-card rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-border/50">
        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-amber-600" />
        </div>

        {/* Heading */}
        <h2 className="text-lg font-semibold text-center mb-2">
          Open in {systemBrowserName} to Sign In
        </h2>
        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-5">
          Google blocks sign-in from {browserName}'s browser for security reasons.
          Open GutSync AI in <strong>{systemBrowserName}</strong> to continue.
        </p>

        {/* Steps */}
        <div className="bg-muted/50 rounded-2xl p-4 mb-5 space-y-2.5">
          {isIOS ? (
            <>
              <Step number={1} text={`Tap the share icon (⎙) at the bottom of ${browserName}`} />
              <Step number={2} text={`Select "Open in Safari"`} />
              <Step number={3} text="Sign in from Safari" />
            </>
          ) : (
            <>
              <Step number={1} text={`Tap the three-dot menu (⋮) in ${browserName}`} />
              <Step number={2} text={`Select "Open in Chrome" or "Open in browser"`} />
              <Step number={3} text="Sign in from Chrome" />
            </>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <Button
            className="w-full rounded-xl h-11 gap-2 bg-primary hover:bg-primary/90"
            onClick={handleOpenInBrowser}
          >
            <ExternalLink className="w-4 h-4" />
            Try Opening in {systemBrowserName}
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-xl h-11 gap-2"
            onClick={handleCopyLink}
          >
            <Copy className="w-4 h-4" />
            Copy Link
          </Button>
          <button
            onClick={onDismiss}
            className="w-full text-sm text-muted-foreground text-center py-2 hover:text-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[10px] font-bold">{number}</span>
      </div>
      <p className="text-xs text-foreground/80 leading-relaxed">{text}</p>
    </div>
  );
}
