// Triggerplate — Profile Page
// Wired to real auth

import { useEffect, useRef, useState } from "react";
import RemindersCard from "@/components/RemindersCard";
import DietaryProfile from "@/components/DietaryProfile";
import FounderCard from "@/components/FounderCard";
import BillingCard from "@/components/BillingCard";
import DoctorReportCard from "@/components/DoctorReportCard";
import AboutYou from "@/components/AboutYou";
import DeleteAccount from "@/components/DeleteAccount";
import { motion } from "framer-motion";
import { User, Download, Shield, ChevronRight, Camera, Apple, LogOut, Smartphone } from "lucide-react";
import Avatar from "@/components/Avatar";
import { prepareAvatar } from "@/lib/image";
import { trpc } from "@/lib/trpc";
import { InstallSheet, useInstallAction } from "@/components/InstallPrompt";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

function SettingsRow({ icon: Icon, label, description, action, iconColor = "text-primary" }: {
  icon: React.ElementType;
  label: string;
  description?: string;
  action?: React.ReactNode;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`w-9 h-9 rounded-xl bg-muted/70 flex items-center justify-center ${iconColor}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action || <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </div>
  );
}

export default function Profile() {
  const install = useInstallAction();
  const { user, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const setAvatar = trpc.profile.setAvatar.useMutation({
    onSuccess: () => { utils.auth.me.invalidate(); toast.success("Photo updated"); },
    onError: e => toast.error(e.message || "Couldn't save that photo."),
  });
  const removeAvatar = trpc.profile.removeAvatar.useMutation({
    onSuccess: () => { utils.auth.me.invalidate(); toast.success("Photo removed"); },
    onError: () => toast.error("Couldn't remove the photo."),
  });
  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      setAvatar.mutate({ imageBase64: await prepareAvatar(file) });
    } catch {
      toast.error("Couldn't read that photo. Try a JPEG or PNG.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // After Google sign-in linked an email-and-password account, say so once: its password was removed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("notice") === "google-linked") {
      toast.success("Signed in with Google", { description: "This account now uses Google. Its old password was removed. Use Forgot password if you want one again.", duration: 9000 });
      params.delete("notice");
      const q = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
    }
  }, []);

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await utils.client.profile.exportData.query();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `triggerplate-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Your data was downloaded");
    } catch {
      toast.error("Couldn't prepare your export. Try again in a moment.");
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <motion.div variants={item} className="mb-6">
        <h1 className="text-2xl tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your health settings and preferences</p>
      </motion.div>

      {/* User Card */}
      <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={setAvatar.isPending}
              className="relative shrink-0 rounded-full" aria-label="Change profile photo">
              <Avatar user={user} size={64} className={`border-2 border-primary/20 ${setAvatar.isPending ? "opacity-60" : ""}`} />
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center border-2 border-card">
                <Camera className="w-3 h-3 text-primary-foreground" />
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onPickPhoto(e.target.files?.[0])} />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-display truncate">{user.name || 'Triggerplate User'}</h2>
              <p className="text-xs text-muted-foreground truncate">{user.email || 'Tracking your gut health'}</p>
              <div className="flex gap-3 mt-1.5 text-xs font-medium">
                <button type="button" onClick={() => fileRef.current?.click()} className="text-primary">{user.avatarUrl ? "Change photo" : "Add photo"}</button>
                {user.avatarUrl && <button type="button" onClick={() => removeAvatar.mutate()} className="text-muted-foreground">Remove</button>}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground mb-3">Sign in to save your data</p>
            <a href={getLoginUrl()}>
              <Button className="rounded-xl bg-primary hover:bg-primary/90">Sign In</Button>
            </a>
          </div>
        )}
      </motion.div>

      {/* Foods I suspect */}
      <motion.div variants={item}>
        <FounderCard />
        <DoctorReportCard />
        <BillingCard />
        <AboutYou />
        <DietaryProfile />
      </motion.div>

      {/* Reminders */}
      <motion.div variants={item}>
        <RemindersCard />
      </motion.div>

      {/* Add to home screen */}
      <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
        <SettingsRow icon={Smartphone} label="Add to Home Screen" description={install.installed ? "Triggerplate is installed on this device" : "Open Triggerplate like an app, full-screen"} action={
          install.installed ? <span className="text-xs font-semibold text-muted-foreground">Installed</span> : <button onClick={install.start} className="text-xs font-semibold text-primary">Add</button>
        } />
        <InstallSheet open={install.sheetOpen} onClose={install.closeSheet} platform={install.platform} />
      </motion.div>

      {/* Privacy & Data */}
      <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-sage-dark" />
          Privacy & Data
        </h3>
        <div className="space-y-1 divide-y divide-border/50">
          <SettingsRow icon={Shield} label="Privacy Policy" description="How Triggerplate handles your data" iconColor="text-sage-dark" action={
            <a href="/privacy" className="text-xs font-semibold text-primary">View</a>
          } />
          <SettingsRow icon={Shield} label="Terms of Service" description="The rules for using Triggerplate" iconColor="text-sage-dark" action={
            <a href="/terms" className="text-xs font-semibold text-primary">View</a>
          } />
          <SettingsRow icon={Shield} label="Health Data Policy" description="How your health information is handled" iconColor="text-sage-dark" action={
            <a href="/health-data-privacy" className="text-xs font-semibold text-primary">View</a>
          } />
          <SettingsRow icon={Shield} label="Medical Disclaimer" description="What Triggerplate is and is not" iconColor="text-sage-dark" action={
            <a href="/disclaimer" className="text-xs font-semibold text-primary">View</a>
          } />
          <SettingsRow icon={Shield} label="Data Protection" description="Protected account, meal, and symptom data" iconColor="text-sage-dark" />
          <SettingsRow icon={Download} label="Export My Data" description="Download everything you've logged (JSON file)" iconColor="text-primary" action={
            <button onClick={handleExport} disabled={exporting} className="text-xs font-semibold text-primary disabled:opacity-60">
              {exporting ? "Preparing..." : "Download"}
            </button>
          } />
          <DeleteAccount hasPassword={!!user?.hasPassword} />
        </div>
      </motion.div>

      {/* Logout */}
      {isAuthenticated && (
        <motion.div variants={item} className="mb-5">
          <Button
            variant="outline"
            className="w-full rounded-xl h-12 gap-2 text-coral border-coral/20 hover:bg-coral-light/20"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </motion.div>
      )}

      {/* App Info */}
      <motion.div variants={item} className="text-center py-4">
        <p className="text-xs text-muted-foreground">Triggerplate v1.0.0</p>
        <p className="text-[11px] text-muted-foreground mt-1">Discover your personal food triggers</p>
      </motion.div>
    </motion.div>
  );
}
