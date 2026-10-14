// GutSync — Bottom Navigation
// Centered scan FAB with long-press to upload from gallery

import { useLocation, Link } from "wouter";
import { Home, ClipboardList, BarChart3, Camera, Upload, Dumbbell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useCallback } from "react";
import FoodCaptureModal from "./FoodCaptureModal";

const leftItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/log", icon: ClipboardList, label: "Log" },
];

const rightItems = [
  { path: "/insights", icon: BarChart3, label: "Insights" },
  { path: "/progress", icon: Dumbbell, label: "Progress" },
];

function NavItem({ path, icon: Icon, label, isActive }: {
  path: string; icon: React.ElementType; label: string; isActive: boolean;
}) {
  return (
    <Link href={path}>
      <motion.div
        className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-[48px]"
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
  const [captureMode, setCaptureMode] = useState<"camera" | "upload">("camera");
  const [showUploadHint, setShowUploadHint] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePressStart = useCallback(() => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowUploadHint(true);
      // Trigger haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isLongPress.current) {
      // Long press — open file picker for gallery upload
      setShowUploadHint(false);
      fileInputRef.current?.click();
    } else {
      // Short tap — open camera capture
      setCaptureMode("camera");
      setShowCapture(true);
    }
  }, []);

  const handlePressCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    isLongPress.current = false;
    setShowUploadHint(false);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCaptureMode("upload");
      setShowCapture(true);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }, []);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-lg">
          <div className="relative mx-3 mb-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-border/50 shadow-lg shadow-black/5 px-2 py-2">
            <div className="flex items-center justify-between">
              {/* Left nav items */}
              <div className="flex items-center gap-0.5 flex-1 justify-evenly">
                {leftItems.map((item) => (
                  <NavItem key={item.path} {...item} isActive={location === item.path} />
                ))}
              </div>

              {/* Camera FAB - centered */}
              <div className="relative flex flex-col items-center mx-2">
                {/* Upload hint tooltip */}
                <AnimatePresence>
                  {showUploadHint && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.9 }}
                      className="absolute -top-20 whitespace-nowrap bg-foreground text-background text-xs font-medium px-3 py-2 rounded-xl shadow-lg"
                    >
                      <Upload className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                      Release to upload photo
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-foreground rotate-45 rounded-sm" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  onPointerDown={handlePressStart}
                  onPointerUp={handlePressEnd}
                  onPointerLeave={handlePressCancel}
                  whileTap={{ scale: 0.9 }}
                  className={`-mt-10 w-14 h-14 rounded-full shadow-lg flex items-center justify-center ring-4 ring-white/80 transition-colors select-none touch-none ${
                    showUploadHint
                      ? "bg-coral text-white shadow-coral/30"
                      : "bg-primary text-primary-foreground shadow-primary/30"
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {showUploadHint ? (
                      <motion.div
                        key="upload"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Upload className="w-6 h-6" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="camera"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Camera className="w-6 h-6" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
                <span className="text-[10px] font-medium text-muted-foreground mt-0.5">Scan</span>
              </div>

              {/* Right nav items */}
              <div className="flex items-center gap-0.5 flex-1 justify-evenly">
                {rightItems.map((item) => (
                  <NavItem key={item.path} {...item} isActive={location === item.path} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hidden file input for gallery upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <FoodCaptureModal
        open={showCapture}
        onClose={() => setShowCapture(false)}
        initialMode={captureMode}
        uploadedFile={fileInputRef.current?.files?.[0] ?? null}
      />
    </>
  );
}
