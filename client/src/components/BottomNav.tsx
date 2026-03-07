// GutSync AI — Bottom Navigation
// Design: Organic Minimalism — floating bottom bar with centered camera FAB

import { useLocation, Link } from "wouter";
import { Home, UtensilsCrossed, Activity, BarChart3, User, Camera } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import FoodCaptureModal from "./FoodCaptureModal";

const leftItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/food", icon: UtensilsCrossed, label: "Food" },
];

const rightItems = [
  { path: "/symptoms", icon: Activity, label: "Symptoms" },
  { path: "/insights", icon: BarChart3, label: "Insights" },
  { path: "/profile", icon: User, label: "Profile" },
];

function NavItem({ path, icon: Icon, label, isActive }: {
  path: string; icon: React.ElementType; label: string; isActive: boolean;
}) {
  return (
    <Link href={path}>
      <motion.div
        className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors"
        whileTap={{ scale: 0.95 }}
      >
        <Icon
          className={`w-5 h-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
          strokeWidth={isActive ? 2.5 : 1.8}
        />
        <span className={`text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
          {label}
        </span>
      </motion.div>
    </Link>
  );
}

export default function BottomNav() {
  const [location] = useLocation();
  const [showCapture, setShowCapture] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-lg">
          <div className="relative mx-3 mb-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-border/50 shadow-lg shadow-black/5 px-3 py-2">
            <div className="flex items-center justify-between">
              {/* Left nav items */}
              <div className="flex items-center gap-1">
                {leftItems.map((item) => (
                  <NavItem key={item.path} {...item} isActive={location === item.path} />
                ))}
              </div>

              {/* Camera FAB - centered */}
              <div className="relative flex flex-col items-center">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowCapture(true)}
                  className="-mt-10 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center ring-4 ring-white/80"
                >
                  <Camera className="w-6 h-6" />
                </motion.button>
                <span className="text-[10px] font-medium text-muted-foreground mt-0.5">Scan</span>
              </div>

              {/* Right nav items */}
              <div className="flex items-center gap-1">
                {rightItems.map((item) => (
                  <NavItem key={item.path} {...item} isActive={location === item.path} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <FoodCaptureModal open={showCapture} onClose={() => setShowCapture(false)} />
    </>
  );
}
