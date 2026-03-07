// GutSync AI — Food Capture Modal
// Design: Organic Minimalism — calming photo upload with AI analysis simulation

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Upload, Sparkles, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FoodCaptureModalProps {
  open: boolean;
  onClose: () => void;
}

const ANALYSIS_STEPS = [
  "Identifying food items...",
  "Detecting hidden ingredients...",
  "Analyzing FODMAP levels...",
  "Checking for known triggers...",
  "Generating breakdown...",
];

interface AnalyzedFood {
  name: string;
  fodmap: 'low' | 'moderate' | 'high';
  hidden: string[];
}

const MOCK_RESULTS: AnalyzedFood[] = [
  { name: "Grilled Chicken Breast", fodmap: 'low', hidden: ['olive oil', 'lemon juice', 'herbs'] },
  { name: "Brown Rice", fodmap: 'low', hidden: ['salt'] },
  { name: "Roasted Broccoli", fodmap: 'high', hidden: ['garlic oil', 'red pepper flakes'] },
  { name: "Tahini Dressing", fodmap: 'moderate', hidden: ['sesame', 'lemon', 'garlic'] },
];

export default function FoodCaptureModal({ open, onClose }: FoodCaptureModalProps) {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'results'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      startAnalysis();
    }
  };

  const handleDemoAnalysis = () => {
    setPreviewUrl('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop');
    startAnalysis();
  };

  const startAnalysis = () => {
    setStep('analyzing');
    setAnalysisStep(0);

    ANALYSIS_STEPS.forEach((_, i) => {
      setTimeout(() => setAnalysisStep(i), (i + 1) * 700);
    });

    setTimeout(() => {
      setStep('results');
    }, ANALYSIS_STEPS.length * 700 + 500);
  };

  const handleSave = () => {
    toast.success("Meal logged successfully", {
      description: "AI detected 4 items with FODMAP analysis",
    });
    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setPreviewUrl(null);
    setAnalysisStep(0);
    onClose();
  };

  const fodmapBadge = (level: 'low' | 'moderate' | 'high') => {
    const styles = {
      low: 'bg-sage-light/60 text-sage-dark',
      moderate: 'bg-sand text-sand-dark',
      high: 'bg-coral-light/60 text-coral',
    };
    return (
      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${styles[level]}`}>
        {level} FODMAP
      </span>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-card rounded-t-3xl sm:rounded-3xl p-6 max-h-[85vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display">
                {step === 'upload' && 'Log a Meal'}
                {step === 'analyzing' && 'Analyzing...'}
                {step === 'results' && 'AI Analysis'}
              </h2>
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Upload Step */}
            {step === 'upload' && (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">Take or upload a photo</p>
                    <p className="text-sm text-muted-foreground mt-1">Our AI will identify foods and hidden ingredients</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or try a demo</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <Button
                  variant="outline"
                  className="w-full rounded-xl h-12 gap-2"
                  onClick={handleDemoAnalysis}
                >
                  <Sparkles className="w-4 h-4" />
                  Analyze Demo Meal
                </Button>
              </div>
            )}

            {/* Analyzing Step */}
            {step === 'analyzing' && (
              <div className="space-y-6">
                {previewUrl && (
                  <div className="rounded-2xl overflow-hidden">
                    <img src={previewUrl} alt="Meal" className="w-full h-48 object-cover" />
                  </div>
                )}
                <div className="space-y-3">
                  {ANALYSIS_STEPS.map((text, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: analysisStep >= i ? 1 : 0.3, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-center gap-3"
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                        analysisStep > i ? 'bg-primary' : analysisStep === i ? 'bg-primary/20' : 'bg-muted'
                      }`}>
                        {analysisStep > i ? (
                          <Check className="w-3 h-3 text-primary-foreground" />
                        ) : analysisStep === i ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full"
                          />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                      <span className={`text-sm ${analysisStep >= i ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {text}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Results Step */}
            {step === 'results' && (
              <div className="space-y-5">
                {previewUrl && (
                  <div className="rounded-2xl overflow-hidden">
                    <img src={previewUrl} alt="Meal" className="w-full h-40 object-cover" />
                  </div>
                )}

                <div className="space-y-3">
                  {MOCK_RESULTS.map((food, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-muted/50 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{food.name}</span>
                            {food.fodmap === 'high' && (
                              <AlertTriangle className="w-3.5 h-3.5 text-coral" />
                            )}
                          </div>
                          {fodmapBadge(food.fodmap)}
                        </div>
                      </div>
                      {food.hidden.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {food.hidden.map((h, j) => (
                            <span key={j} className="text-[11px] px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Warning for high FODMAP */}
                <div className="bg-coral-light/30 border border-coral/20 rounded-xl p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-coral shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">High FODMAP Alert</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Broccoli and garlic oil are known triggers. I'll monitor for symptoms in the next 4-6 hours.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={handleClose}>
                    Discard
                  </Button>
                  <Button className="flex-1 rounded-xl h-12 bg-primary hover:bg-primary/90" onClick={handleSave}>
                    <Upload className="w-4 h-4 mr-2" />
                    Save Meal
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
