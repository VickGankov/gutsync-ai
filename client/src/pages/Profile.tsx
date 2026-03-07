// GutSync AI — Profile Page
// Design: Organic Minimalism — personal settings, wearable connections, dietary profile

import { motion } from "framer-motion";
import { User, Watch, Shield, Bell, ChevronRight, Leaf, Apple, Smartphone, Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const WELLNESS_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663031724495/Aye9Tq4ostcsrtEqbKqav7/gutsync-wellness-Y3yqX8dgxLnj59BBic4aog.webp";

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
  const handleToggle = (feature: string) => {
    toast.success(`${feature} updated`, { description: "Feature coming soon" });
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
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={WELLNESS_IMG}
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover border-2 border-primary/20"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-sage flex items-center justify-center">
              <Leaf className="w-3 h-3 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-display">Sarah M.</h2>
            <p className="text-xs text-muted-foreground">Tracking since Feb 2026</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                5-day streak
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Dietary Profile */}
      <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Apple className="w-4 h-4 text-coral" />
          Dietary Profile
        </h3>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {['Low FODMAP', 'IBS-D', 'Lactose Sensitive', 'Fructan Sensitive'].map((tag) => (
              <span key={tag} className="text-xs px-3 py-1.5 rounded-full bg-muted border border-border text-foreground font-medium">
                {tag}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            The AI uses your profile to prioritize relevant ingredient detection and trigger analysis.
          </p>
        </div>
      </motion.div>

      {/* Connected Devices */}
      <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Watch className="w-4 h-4 text-primary" />
          Connected Devices
        </h3>
        <div className="space-y-1 divide-y divide-border/50">
          <SettingsRow
            icon={Watch}
            label="Apple Watch"
            description="HRV, Heart Rate, Sleep"
            iconColor="text-sage-dark"
            action={
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sage-light/50 text-sage-dark">
                Connected
              </span>
            }
          />
          <SettingsRow
            icon={Smartphone}
            label="Apple Health"
            description="Activity, Steps, Workouts"
            iconColor="text-coral"
            action={
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sage-light/50 text-sage-dark">
                Connected
              </span>
            }
          />
          <SettingsRow
            icon={Watch}
            label="Garmin Connect"
            description="Not connected"
            iconColor="text-muted-foreground"
            action={
              <button
                onClick={() => toast.success("Feature coming soon")}
                className="text-xs text-primary font-medium"
              >
                Connect
              </button>
            }
          />
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4 text-sand-dark" />
          Notifications
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Meal Reminders</p>
              <p className="text-xs text-muted-foreground">Gentle nudges to log meals</p>
            </div>
            <Switch defaultChecked onCheckedChange={() => handleToggle("Meal reminders")} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Symptom Check-ins</p>
              <p className="text-xs text-muted-foreground">Ask how you feel after high-FODMAP meals</p>
            </div>
            <Switch defaultChecked onCheckedChange={() => handleToggle("Symptom check-ins")} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Discovery Alerts</p>
              <p className="text-xs text-muted-foreground">When AI finds a new trigger pattern</p>
            </div>
            <Switch defaultChecked onCheckedChange={() => handleToggle("Discovery alerts")} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Weekly Summary</p>
              <p className="text-xs text-muted-foreground">Sunday gut health report</p>
            </div>
            <Switch onCheckedChange={() => handleToggle("Weekly summary")} />
          </div>
        </div>
      </motion.div>

      {/* Privacy & Data */}
      <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-sage-dark" />
          Privacy & Data
        </h3>
        <div className="space-y-1 divide-y divide-border/50">
          <SettingsRow icon={Shield} label="Data Encryption" description="End-to-end encrypted" iconColor="text-sage-dark" />
          <SettingsRow icon={User} label="Export My Data" description="Download all your health data" iconColor="text-primary" />
          <SettingsRow icon={Shield} label="Delete Account" description="Permanently remove all data" iconColor="text-coral" />
        </div>
      </motion.div>

      {/* App Info */}
      <motion.div variants={item} className="text-center py-4">
        <p className="text-xs text-muted-foreground">GutSync AI v1.0.0</p>
        <p className="text-[11px] text-muted-foreground mt-1">Your invisible gut health detective</p>
      </motion.div>
    </motion.div>
  );
}
