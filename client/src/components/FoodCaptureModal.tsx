// GutSync — Food Capture Modal
// Supports camera capture and gallery upload, with editable AI results

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Sparkles, Check, AlertTriangle, Save, Plus, Trash2, ChevronDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import Paywall from "@/components/Paywall";

export interface FoodCaptureModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: "camera" | "upload";
  uploadedFile?: File | null;
}

const ANALYSIS_STEPS = [
  "Uploading photo...",
  "Identifying food items...",
  "Detecting hidden ingredients...",
  "Analyzing sensitivity levels...",
  "Generating breakdown...",
];

const FODMAP_OPTIONS = ["low", "moderate", "high"] as const;
const CATEGORY_OPTIONS = ["protein", "carb", "fat", "vegetable", "fruit", "dairy", "grain", "other"] as const;

interface AnalyzedFood {
  name: string;
  category: string;
  fodmap: "low" | "moderate" | "high";
  hiddenIngredients: string[];
}

export default function FoodCaptureModal({ open, onClose, initialMode = "camera", uploadedFile }: FoodCaptureModalProps) {
  const [step, setStep] = useState<"upload" | "analyzing" | "results">("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analyzedFoods, setAnalyzedFoods] = useState<AnalyzedFood[]>([]);
  const [mealSummary, setMealSummary] = useState("");
  const [detectedMealType, setDetectedMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("snack");
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFoodName, setNewFoodName] = useState("");
  const [newFoodCategory, setNewFoodCategory] = useState<string>("other");
  const [newFoodFodmap, setNewFoodFodmap] = useState<"low" | "moderate" | "high">("low");
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallScansUsed, setPaywallScansUsed] = useState(3);
  // Refs removed - using inline <label>+<input> pattern for better mobile compatibility
  const processedFileRef = useRef<File | null>(null);

  const utils = trpc.useUtils();
  const analyzePhoto = trpc.meals.analyzePhoto.useMutation();
  const logManual = trpc.meals.logManual.useMutation();
  const { data: subStatus } = trpc.subscription.status.useQuery(undefined, { retry: false });

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const runAnalysis = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep("analyzing");
    setAnalysisStep(0);
    setError(null);

    const stepInterval = setInterval(() => {
      setAnalysisStep((prev) => {
        if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 800);

    try {
      const base64 = await fileToBase64(file);
      const result = await analyzePhoto.mutateAsync({
        imageBase64: base64,
        mimeType: file.type || "image/jpeg",
      });

      clearInterval(stepInterval);
      setAnalysisStep(ANALYSIS_STEPS.length);
      setAnalyzedFoods(result.foods);
      setMealSummary(result.summary);
      setDetectedMealType(result.mealType || "snack");
      setSavedPhotoUrl(result.photoUrl || null);
      utils.subscription.status.invalidate();
      setTimeout(() => setStep("results"), 400);
    } catch (err: unknown) {
      clearInterval(stepInterval);
      const msg = err instanceof Error ? err.message : String(err);
      // Check if this is a free-tier limit error
      if (msg.includes("FREE_LIMIT_REACHED")) {
        const used = parseInt(msg.split(":")[1] ?? "3", 10);
        setPaywallScansUsed(used);
        setStep("upload");
        setPreviewUrl(null);
        setShowPaywall(true);
        return;
      }
      // Check if no food was detected
      if (msg.includes("NO_FOOD_DETECTED")) {
        setError("No food detected in this photo. Please try again with a clearer food photo.");
        toast.error("No food detected", { description: "Make sure the photo shows actual food items." });
      } else {
        setError(msg || "Analysis failed. Please try again.");
        toast.error("Analysis failed", { description: "Please try again with a clearer photo." });
      }
      setStep("upload");
      setPreviewUrl(null);
    }
  }, [analyzePhoto]);

  // Handle uploaded file from long-press
  useEffect(() => {
    if (open && uploadedFile && uploadedFile !== processedFileRef.current) {
      processedFileRef.current = uploadedFile;
      runAnalysis(uploadedFile);
    }
  }, [open, uploadedFile, runAnalysis]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[FoodCapture] handleFileSelect fired', e.target.files?.length);
    const file = e.target.files?.[0];
    if (!file) {
      console.log('[FoodCapture] No file selected');
      return;
    }
    console.log('[FoodCapture] File selected:', file.name, file.type, file.size);
    processedFileRef.current = file;
    runAnalysis(file);
  };

  // ─── Food editing functions ───

  const handleRemoveFood = (index: number) => {
    setAnalyzedFoods(prev => prev.filter((_, i) => i !== index));
    setEditingIndex(null);
    toast("Item removed", { description: "You can add it back with the + button" });
  };

  const handleUpdateFodmap = (index: number, fodmap: "low" | "moderate" | "high") => {
    setAnalyzedFoods(prev => prev.map((f, i) => i === index ? { ...f, fodmap } : f));
  };

  const handleUpdateName = (index: number, name: string) => {
    setAnalyzedFoods(prev => prev.map((f, i) => i === index ? { ...f, name } : f));
  };

  const handleAddFood = () => {
    if (!newFoodName.trim()) return;
    setAnalyzedFoods(prev => [
      ...prev,
      {
        name: newFoodName.trim(),
        category: newFoodCategory,
        fodmap: newFoodFodmap,
        hiddenIngredients: [],
      },
    ]);
    setNewFoodName("");
    setNewFoodCategory("other");
    setNewFoodFodmap("low");
    setShowAddForm(false);
    toast.success("Item added");
  };

  const handleSave = () => {
    if (analyzedFoods.length === 0) {
      toast.error("Add at least one food item before saving");
      return;
    }
    logManual.mutate(
      {
        mealType: detectedMealType,
        foods: analyzedFoods.map(f => ({
          name: f.name,
          category: f.category as "protein" | "carb" | "fat" | "vegetable" | "fruit" | "dairy" | "grain" | "other",
          fodmap: f.fodmap,
          hiddenIngredients: f.hiddenIngredients,
        })),
        notes: mealSummary || undefined,
        photoUrl: savedPhotoUrl || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Meal logged successfully", {
            description: `${analyzedFoods.length} items saved with sensitivity analysis`,
          });
          utils.meals.list.invalidate();
          utils.insights.dashboard.invalidate();
          utils.subscription.status.invalidate();
          handleClose();
        },
        onError: (error) => {
          toast.error("Failed to save meal", {
            description: error.message || "Please try again",
          });
        },
      }
    );
  };

  const handleClose = () => {
    setStep("upload");
    setPreviewUrl(null);
    setAnalysisStep(0);
    setAnalyzedFoods([]);
    setMealSummary("");
    setError(null);
    setEditingIndex(null);
    setShowAddForm(false);
    setNewFoodName("");
    processedFileRef.current = null;
    onClose();
  };

  const fodmapBadge = (level: "low" | "moderate" | "high", interactive = false, onClick?: () => void) => {
    const styles = {
      low: "bg-sage-light/60 text-sage-dark",
      moderate: "bg-sand text-sand-dark",
      high: "bg-coral-light/60 text-coral",
    };
    return (
      <button
        onClick={onClick}
        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${styles[level]} ${interactive ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
        disabled={!interactive}
      >
        {level} FODMAP
        {interactive && <ChevronDown className="w-2.5 h-2.5 inline ml-0.5" />}
      </button>
    );
  };

  const hasHighFodmap = analyzedFoods.some((f) => f.fodmap === "high");
  const highFodmapFoods = analyzedFoods.filter((f) => f.fodmap === "high");

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          key="food-capture-modal"
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
                {step === "upload" && "Log a Meal"}
                {step === "analyzing" && "Analyzing..."}
                {step === "results" && "Analysis Results"}
              </h2>
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Upload Step */}
            {step === "upload" && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <p className="text-sm text-muted-foreground">
                    We'll help identify foods and hidden ingredients — you confirm what you ate
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-primary" />
                    </div>
                    <p className="font-medium text-foreground text-sm">Take Photo</p>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  <label
                    className="border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-sage-light/60 flex items-center justify-center">
                      <Plus className="w-6 h-6 text-sage-dark" />
                    </div>
                    <p className="font-medium text-foreground text-sm">Upload Photo</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                {error && (
                  <div className="bg-coral-light/30 border border-coral/20 rounded-xl p-3 text-sm text-coral">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Analyzing Step */}
            {step === "analyzing" && (
              <div className="space-y-6">
                {previewUrl && (
                  <div className="rounded-2xl overflow-hidden">
                    <img src={previewUrl} alt="Meal" className="w-full h-48 object-cover" />
                  </div>
                )}
                <div className="space-y-3">
                  {ANALYSIS_STEPS.map((text, i) => (
                    <motion.div
                      key={`step-${i}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: analysisStep >= i ? 1 : 0.3, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-center gap-3"
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                          analysisStep > i
                            ? "bg-primary"
                            : analysisStep === i
                              ? "bg-primary/20"
                              : "bg-muted"
                        }`}
                      >
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
                      <span className={`text-sm ${analysisStep >= i ? "text-foreground" : "text-muted-foreground"}`}>
                        {text}
                      </span>
                    </motion.div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Analyzing your meal — this may take a few seconds
                </p>
              </div>
            )}

            {/* Results Step — Editable */}
            {step === "results" && (
              <div className="space-y-5">
                {previewUrl && (
                  <div className="rounded-2xl overflow-hidden">
                    <img src={previewUrl} alt="Meal" className="w-full h-40 object-cover" />
                  </div>
                )}

                {mealSummary && (
                  <p className="text-sm text-muted-foreground italic">{mealSummary}</p>
                )}

                {/* Editable hint */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Tap an item to edit. Swipe or tap <Trash2 className="w-3 h-3 inline" /> to remove.</span>
                </div>

                {/* Food items list */}
                <div className="space-y-2.5">
                  {analyzedFoods.map((food, i) => (
                    <motion.div
                      key={`${food.name}-${i}`}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ delay: i * 0.05 }}
                      className={`bg-muted/50 rounded-xl p-4 transition-all ${editingIndex === i ? "ring-2 ring-primary/30" : ""}`}
                      onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {editingIndex === i ? (
                            <input
                              type="text"
                              value={food.name}
                              onChange={(e) => handleUpdateName(i, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-sm bg-background border border-border rounded-lg px-2 py-1 w-full mb-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{food.name}</span>
                              {food.fodmap === "high" && <AlertTriangle className="w-3.5 h-3.5 text-coral" />}
                            </div>
                          )}

                          {editingIndex === i ? (
                            <div className="flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              {FODMAP_OPTIONS.map((level) => (
                                <button
                                  key={level}
                                  onClick={() => handleUpdateFodmap(i, level)}
                                  className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full transition-all ${
                                    food.fodmap === level
                                      ? level === "low" ? "bg-sage-light/60 text-sage-dark ring-2 ring-sage/30"
                                        : level === "moderate" ? "bg-sand text-sand-dark ring-2 ring-sand-dark/30"
                                        : "bg-coral-light/60 text-coral ring-2 ring-coral/30"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {level}
                                </button>
                              ))}
                            </div>
                          ) : (
                            fodmapBadge(food.fodmap)
                          )}
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFood(i);
                          }}
                          className="p-1.5 rounded-lg hover:bg-coral-light/30 transition-colors group"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-coral transition-colors" />
                        </button>
                      </div>

                      {food.hiddenIngredients.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {food.hiddenIngredients.map((h, j) => (
                            <span
                              key={`hidden-${h}-${j}`}
                              className="text-[11px] px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Add food item */}
                <AnimatePresence>
                  {showAddForm ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3"
                    >
                      <p className="text-sm font-medium text-foreground">Add a food item</p>
                      <input
                        type="text"
                        value={newFoodName}
                        onChange={(e) => setNewFoodName(e.target.value)}
                        placeholder="Food name (e.g., Garlic Bread)"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleAddFood()}
                      />
                      <div className="flex gap-2">
                        <select
                          value={newFoodCategory}
                          onChange={(e) => setNewFoodCategory(e.target.value)}
                          className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {CATEGORY_OPTIONS.map((cat) => (
                            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                          ))}
                        </select>
                        <div className="flex gap-1">
                          {FODMAP_OPTIONS.map((level) => (
                            <button
                              key={level}
                              onClick={() => setNewFoodFodmap(level)}
                              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full transition-all ${
                                newFoodFodmap === level
                                  ? level === "low" ? "bg-sage-light/60 text-sage-dark ring-2 ring-sage/30"
                                    : level === "moderate" ? "bg-sand text-sand-dark ring-2 ring-sand-dark/30"
                                    : "bg-coral-light/60 text-coral ring-2 ring-coral/30"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-lg"
                          onClick={() => { setShowAddForm(false); setNewFoodName(""); }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 rounded-lg bg-primary hover:bg-primary/90"
                          onClick={handleAddFood}
                          disabled={!newFoodName.trim()}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setShowAddForm(true)}
                      className="w-full border-2 border-dashed border-border rounded-xl p-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Add missing item
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* Warning for high FODMAP */}
                {hasHighFodmap && (
                  <div className="bg-coral-light/30 border border-coral/20 rounded-xl p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-coral shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">High Sensitivity Alert</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {highFodmapFoods.map((f) => f.name).join(", ")}{" "}
                        {highFodmapFoods.length === 1 ? "is" : "are"} high sensitivity. I'll monitor for symptoms in the next 4-6 hours.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={handleClose}>
                    Discard
                  </Button>
                  <Button
                    className="flex-1 rounded-xl h-12 bg-primary hover:bg-primary/90"
                    onClick={handleSave}
                    disabled={analyzedFoods.length === 0}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Meal
                  </Button>
                </div>
              </div>
            )}

            {/* Scan counter badge for free tier */}
            {subStatus && !subStatus.isPremium && step === "upload" && (
              <div className="mt-4 space-y-2">
                {(subStatus.scansRemaining ?? 0) === 1 && (
                  <div className="bg-sand/20 border border-sand text-sand-dark rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>This is your last free scan today. Upgrade for unlimited scans.</span>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                    (subStatus.scansRemaining ?? 0) === 0
                      ? "bg-coral-light/40 text-coral"
                      : (subStatus.scansRemaining ?? 0) === 1
                        ? "bg-sand text-sand-dark"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {(subStatus.scansRemaining ?? 0) === 0 ? (
                      <><Lock className="w-3 h-3" /> No free scans left today</>
                    ) : (
                      <><Sparkles className="w-3 h-3" /> {subStatus.scansRemaining} free scan{(subStatus.scansRemaining ?? 0) !== 1 ? "s" : ""} left today</>
                    )}
                  </div>
                  {(subStatus.scansRemaining ?? 0) === 0 && (
                    <button
                      onClick={() => setShowPaywall(true)}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Upgrade
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

    </AnimatePresence>
      {/* Paywall overlay - outside AnimatePresence to avoid key conflicts */}
      <Paywall
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={() => {
          setShowPaywall(false);
          toast.success("Premium activated! You now have unlimited scans.");
        }}
        scansUsed={paywallScansUsed}
        dailyLimit={subStatus?.dailyLimit ?? 3}
      />
    </>
  );
}
