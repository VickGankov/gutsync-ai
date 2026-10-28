// Triggerplate — Food Capture Modal
// Supports camera capture and gallery upload, with editable AI results

import { invalidateToday } from "@/lib/invalidateToday";
import { mlToOz, ozToMl } from "@/lib/units";
import { prepareImageForUpload } from "@/lib/image";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Sparkles, Check, AlertTriangle, Save, Plus, Trash2, ChevronDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import Paywall from "@/components/Paywall";
import { sensitivitiesIn, sensitivityShort } from "@shared/sensitivities";

export interface FoodCaptureModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: "camera" | "upload";
  uploadedFile?: File | null;
}

const TEXT_STEPS = [
  "Reading your description...",
  "Identifying food items...",
  "Detecting hidden ingredients...",
  "Analyzing sensitivity levels...",
  "Generating breakdown...",
];

/** Value for a datetime-local input, in the viewer's local time. */
function toLocalInput(ms: number) {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
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
const MEAL_TYPE_OPTIONS = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPE_OPTIONS)[number];

interface AnalyzedFood {
  name: string;
  category: string;
  fodmap: "low" | "moderate" | "high";
  hiddenIngredients: string[];
  proteinGrams?: number;
  fiberGrams?: number;
  volumeMl?: number;
  packaged?: boolean;
  ingredients?: string[];
  basis?: "label" | "database" | "estimate";
}

export default function FoodCaptureModal({ open, onClose, initialMode = "camera", uploadedFile }: FoodCaptureModalProps) {
  const [step, setStep] = useState<"upload" | "analyzing" | "results">("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analyzedFoods, setAnalyzedFoods] = useState<AnalyzedFood[]>([]);
  const [mealSummary, setMealSummary] = useState("");
  const [detectedMealType, setDetectedMealType] = useState<MealType>("snack");
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFoodName, setNewFoodName] = useState("");
  const [newFoodCategory, setNewFoodCategory] = useState<string>("other");
  const [newFoodFodmap, setNewFoodFodmap] = useState<"low" | "moderate" | "high">("low");
  const [labelBusy, setLabelBusy] = useState<number | null>(null);
  const [foodFile, setFoodFile] = useState<File | null>(null);
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [foodThumb, setFoodThumb] = useState<string | null>(null);
  const [labelThumb, setLabelThumb] = useState<string | null>(null);
  const [typedText, setTypedText] = useState("");
  const [isTextEntry, setIsTextEntry] = useState(false);
  /** When it was eaten, as a datetime-local string; null means "now". */
  const [eatenAt, setEatenAt] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallScansUsed, setPaywallScansUsed] = useState(10);
  // Refs removed - using inline <label>+<input> pattern for better mobile compatibility
  const processedFileRef = useRef<File | null>(null);

  const utils = trpc.useUtils();
  const analyzePhoto = trpc.meals.analyzePhoto.useMutation();
  const analyzeText = trpc.meals.analyzeText.useMutation();
  const readLabel = trpc.meals.readLabel.useMutation();
  const logManual = trpc.meals.logManual.useMutation();
  const { data: subStatus } = trpc.subscription.status.useQuery(undefined, { retry: false });
  const mySensitivities = trpc.auth.me.useQuery().data?.sensitivities ?? [];

  const runAnalysis = useCallback(async (file: File, label?: File | null) => {
    const url = URL.createObjectURL(file);
    setIsTextEntry(false);
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
      const [prepared, preparedLabel] = await Promise.all([
        prepareImageForUpload(file),
        label ? prepareImageForUpload(label) : Promise.resolve(null),
      ]);
      const result = await analyzePhoto.mutateAsync({
        imageBase64: prepared.base64,
        mimeType: prepared.mimeType,
        ...(preparedLabel ? { labelBase64: preparedLabel.base64, labelMimeType: preparedLabel.mimeType } : {}),
      });
      if (preparedLabel) {
        if (result.labelRead) toast.success("Ingredients read from label");
        else toast("Couldn't read the label", { description: "Ingredients are estimated. Try a sharper, closer label photo." });
      }

      clearInterval(stepInterval);
      setAnalysisStep(ANALYSIS_STEPS.length);
      setAnalyzedFoods(result.foods);
      if (result.timings) {
        const t = result.timings;
        console.log("[scan timings]", t);
      }
      setMealSummary(result.summary);
      setDetectedMealType(result.mealType || "snack");
      setSavedPhotoUrl(result.photoUrl || null);
      await utils.subscription.status.invalidate();
      await utils.subscription.status.refetch();
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
        const transient = /JSON|Failed to fetch|NetworkError|Load failed|502|503|504/i.test(msg);
        setError(transient ? "The server didn't respond (it may be restarting). Your photo is still here — tap Analyze to try again." : (msg || "Analysis failed. Please try again."));
        toast.error("Analysis failed", { description: "Please try again with a clearer photo." });
      }
      setStep("upload");
      setPreviewUrl(null);
    }
  }, [analyzePhoto, utils.subscription.status]);

  const runTextAnalysis = useCallback(async (text: string) => {
    setIsTextEntry(true);
    setPreviewUrl(null);
    setStep("analyzing");
    setAnalysisStep(0);
    setError(null);
    const stepInterval = setInterval(() => {
      setAnalysisStep((prev) => (prev < TEXT_STEPS.length - 1 ? prev + 1 : prev));
    }, 800);
    try {
      const result = await analyzeText.mutateAsync({ text });
      clearInterval(stepInterval);
      setAnalysisStep(TEXT_STEPS.length);
      setAnalyzedFoods(result.foods);
      setMealSummary(result.summary);
      setDetectedMealType(result.mealType || "snack");
      setSavedPhotoUrl(null);
      await utils.subscription.status.invalidate();
      setTimeout(() => setStep("results"), 400);
    } catch (err: unknown) {
      clearInterval(stepInterval);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("FREE_LIMIT_REACHED")) {
        setPaywallScansUsed(parseInt(msg.split(":")[1] ?? "3", 10));
        setShowPaywall(true);
      } else if (msg.includes("NO_FOOD_DETECTED")) {
        setError("I couldn't find any food in that. Try something like: 2 eggs, toast with butter, coffee.");
      } else {
        setError(msg || "Analysis failed. Please try again.");
      }
      setStep("upload");
    }
  }, [analyzeText, utils.subscription.status]);

  // Handle uploaded file from long-press
  useEffect(() => {
    if (open && uploadedFile && uploadedFile !== processedFileRef.current) {
      processedFileRef.current = uploadedFile;
      runAnalysis(uploadedFile);
    }
  }, [open, uploadedFile, runAnalysis]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processedFileRef.current = file;
    e.target.value = "";
    if (foodThumb) URL.revokeObjectURL(foodThumb);
    setFoodFile(file);
    setFoodThumb(URL.createObjectURL(file));
  };

  const handleLabelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (labelThumb) URL.revokeObjectURL(labelThumb);
    setLabelFile(file);
    setLabelThumb(URL.createObjectURL(file));
  };

  const clearStaged = () => {
    if (foodThumb) URL.revokeObjectURL(foodThumb);
    if (labelThumb) URL.revokeObjectURL(labelThumb);
    setFoodFile(null); setLabelFile(null); setFoodThumb(null); setLabelThumb(null);
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

  const handleUpdateVolume = (index: number, value: string) => {
    const n = value === "" ? 0 : Math.max(0, Math.min(5000, ozToMl(Number(value))));
    setAnalyzedFoods(prev => prev.map((f, i) => i === index ? { ...f, volumeMl: Number.isFinite(n) && n > 0 ? n : undefined } : f));
  };

  const handleUpdateProtein = (index: number, value: string) => {
    const n = value === "" ? undefined : Math.max(0, Math.min(500, Number(value)));
    setAnalyzedFoods(prev => prev.map((f, i) => i === index ? { ...f, proteinGrams: Number.isFinite(n) ? n : undefined } : f));
  };

  const handleLabelPhoto = async (index: number, file: File) => {
    setLabelBusy(index);
    try {
      const prepared = await prepareImageForUpload(file);
      const label = await readLabel.mutateAsync({ imageBase64: prepared.base64, mimeType: prepared.mimeType });
      setAnalyzedFoods(prev => prev.map((f, i) => i !== index ? f : {
        ...f,
        fodmap: label.fodmap,
        hiddenIngredients: label.hiddenIngredients,
        ...(label.proteinGrams ? { proteinGrams: label.proteinGrams } : {}),
        ...(label.productName ? { name: label.productName } : {}),
        packaged: true,
        basis: "label",
        ingredients: label.allIngredients,
      }));
      await utils.subscription.status.invalidate();
      toast.success("Ingredients read from label", {
        description: label.hiddenIngredients.length ? `Flagged: ${label.hiddenIngredients.join(", ")}` : "No common FODMAP triggers found",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("FREE_LIMIT_REACHED")) {
        setShowPaywall(true);
      } else if (msg.includes("LABEL_NOT_READABLE")) {
        toast.error("Couldn't read the ingredient list", { description: "Try a closer, sharper photo of the ingredients." });
      } else {
        toast.error("Label scan failed", { description: "Please try again." });
      }
    } finally {
      setLabelBusy(null);
    }
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
          ...(typeof f.proteinGrams === "number" ? { proteinGrams: f.proteinGrams } : {}),
          ...(typeof f.fiberGrams === "number" ? { fiberGrams: f.fiberGrams } : {}),
          ...(f.volumeMl && f.volumeMl > 0 ? { volumeMl: Math.round(f.volumeMl) } : {}),
          ...(f.ingredients?.length ? { ingredients: f.ingredients } : {}),
        })),
        notes: mealSummary || undefined,
        photoUrl: savedPhotoUrl || undefined,
        ...(eatenAt ? { loggedAt: Math.min(new Date(eatenAt).getTime(), Date.now()) } : {}),
      },
      {
        onSuccess: () => {
          toast.success("Meal logged successfully", {
            description: `${analyzedFoods.length} items saved with sensitivity analysis`,
          });
          invalidateToday(utils);
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
    clearStaged();
    setMealSummary("");
    setTypedText(""); setIsTextEntry(false); setEatenAt(null);
    setDetectedMealType("snack");
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
                {foodFile && foodThumb ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative rounded-2xl overflow-hidden aspect-square bg-muted">
                        <img src={foodThumb} alt="Food" className="w-full h-full object-cover" />
                        <span className="absolute bottom-1.5 left-1.5 text-[11px] font-semibold bg-black/60 text-white px-2 py-0.5 rounded-full">Food</span>
                      </div>
                      {labelFile && labelThumb ? (
                        <div className="relative rounded-2xl overflow-hidden aspect-square bg-muted">
                          <img src={labelThumb} alt="Label" className="w-full h-full object-cover" />
                          <span className="absolute bottom-1.5 left-1.5 text-[11px] font-semibold bg-black/60 text-white px-2 py-0.5 rounded-full">Label</span>
                          <button
                            type="button"
                            onClick={() => { if (labelThumb) URL.revokeObjectURL(labelThumb); setLabelFile(null); setLabelThumb(null); }}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs"
                            aria-label="Remove label photo"
                          >✕</button>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all aspect-square text-center p-3">
                          <Camera className="w-6 h-6 text-primary" />
                          <p className="font-medium text-foreground text-sm">Add label photo</p>
                          <p className="text-[11px] text-muted-foreground">Optional. Ingredients on the back of packaged items.</p>
                          <input type="file" accept="image/*" capture="environment" onChange={handleLabelSelect} className="hidden" />
                        </label>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => runAnalysis(foodFile, labelFile)}
                      className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform"
                    >
                      Analyze{labelFile ? " food + label" : ""}
                    </button>
                    <button type="button" onClick={clearStaged} className="w-full text-sm text-muted-foreground py-1">Choose a different photo</button>
                  </div>
                ) : (
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
                )}
                {!foodFile && (
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 space-y-2">
                    <p className="text-sm font-medium text-foreground">Or type what you ate</p>
                    <textarea
                      value={typedText}
                      onChange={(e) => setTypedText(e.target.value)}
                      rows={2}
                      maxLength={600}
                      placeholder="e.g. 2 eggs, sourdough toast with butter, black coffee"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => runTextAnalysis(typedText.trim())}
                      disabled={typedText.trim().length < 2}
                      className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform"
                    >
                      Analyze text
                    </button>
                    <p className="text-[11px] text-muted-foreground">Uses the same analysis as a photo, so it counts as one scan. You can edit everything before saving.</p>
                  </div>
                )}
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
                  {(isTextEntry ? TEXT_STEPS : ANALYSIS_STEPS).map((text, i) => (
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

                <div className="rounded-2xl border border-border/50 bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Meal type
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {MEAL_TYPE_OPTIONS.map((mealType) => (
                      <button
                        key={mealType}
                        type="button"
                        onClick={() => setDetectedMealType(mealType)}
                        className={`rounded-xl px-2 py-2 text-xs font-semibold capitalize transition-colors ${
                          detectedMealType === mealType
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {mealType}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">When you ate</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={eatenAt ?? toLocalInput(Date.now())}
                      max={toLocalInput(Date.now())}
                      min={toLocalInput(Date.now() - 30 * 86_400_000)}
                      onChange={(e) => setEatenAt(e.target.value || null)}
                      className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    {eatenAt && (
                      <button type="button" onClick={() => setEatenAt(null)} className="text-xs font-medium text-primary px-2 py-1">Now</button>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Symptom timing and triggers use this time, so set it if you're logging a past meal.</p>
                </div>

                {/* Editable hint */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Tap an item to edit. Swipe or tap <Trash2 className="w-3 h-3 inline" /> to remove.</span>
                </div>

                {analyzedFoods.some(f => typeof f.proteinGrams === "number") && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Estimated protein: <span className="font-semibold text-foreground">
                      {Math.round(analyzedFoods.reduce((sum, f) => sum + (f.proteinGrams ?? 0), 0))} g
                    </span> · tap an item to adjust
                  </p>
                )}

                {analyzedFoods.some(f => typeof f.fiberGrams === "number") && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Estimated fiber: <span className="font-semibold text-foreground">
                      {Math.round(analyzedFoods.reduce((sum, f) => sum + (f.fiberGrams ?? 0), 0) * 2) / 2} g
                    </span> (rough estimate)
                  </p>
                )}

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
                            <div className="flex flex-wrap items-center gap-1.5">
                              {fodmapBadge(food.fodmap)}
                              {sensitivitiesIn(food, mySensitivities).map(k => (
                                <span key={k} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  {sensitivityShort(k)}
                                </span>
                              ))}
                            </div>
                          )}

                          {editingIndex === i ? (
                            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                              Protein
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={500}
                                value={food.proteinGrams ?? ""}
                                onChange={(e) => handleUpdateProtein(i, e.target.value)}
                                className="w-20 bg-background border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              g
                            </label>
                          ) : typeof food.proteinGrams === "number" && food.proteinGrams > 0 ? (
                            <p className="mt-1.5 text-xs text-muted-foreground">~{Math.round(food.proteinGrams)} g protein</p>
                          ) : null}
                          {editingIndex !== i && typeof food.fiberGrams === "number" && food.fiberGrams > 0 && (
                            <p className="mt-0.5 text-xs text-muted-foreground">~{food.fiberGrams} g fiber</p>
                          )}
                          {typeof food.volumeMl === "number" && food.volumeMl > 0 && (
                            editingIndex === i ? (
                              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                                💧 Counts toward water
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  max={mlToOz(5000)}
                                  value={mlToOz(food.volumeMl)}
                                  onChange={(e) => handleUpdateVolume(i, e.target.value)}
                                  className="w-20 bg-background border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                oz
                              </label>
                            ) : (
                              <p className="mt-1.5 text-xs text-sky-700 dark:text-sky-300">💧 {mlToOz(food.volumeMl)} oz counts toward water · tap to adjust</p>
                            )
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

                      {(
                        <div className="mt-2 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          {food.basis === "label" || food.basis === "database" ? (
                            <span className="text-[11px] font-medium text-sage-dark bg-sage-light/50 px-2 py-0.5 rounded-full">{food.basis === "label" ? "✓ From product label" : "✓ From Open Food Facts"}</span>
                          ) : (
                            <>
                              <span className="text-[11px] text-muted-foreground">{food.packaged ? "Ingredients estimated from the front of the pack." : "Not right? Scan the label."}</span>
                              <label className="text-[11px] font-semibold text-primary px-2.5 py-1 rounded-full border border-primary/30 cursor-pointer active:scale-95 transition-transform">
                                {labelBusy === i ? "Reading label…" : "📷 Add ingredient label photo"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  disabled={labelBusy !== null}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = "";
                                    if (f) handleLabelPhoto(i, f);
                                  }}
                                />
                              </label>
                            </>
                          )}
                        </div>
                      )}

                      {food.packaged && food.hiddenIngredients.length === 0 && (
                        food.basis === "estimate" && food.fodmap === "moderate" ? (
                          <p className="mt-2 text-[11px] text-muted-foreground">Ingredients unknown, so this rating is a guess. Scan the label for a firm answer.</p>
                        ) : (
                          <p className="mt-2 text-[11px] text-sage-dark">No common FODMAP triggers {food.basis === "estimate" ? "likely" : "in the ingredients"}.</p>
                        )
                      )}
                      {food.ingredients && food.ingredients.length > 0 && (
                        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">Ingredients: {food.ingredients.join(", ")}</p>
                      )}
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

            {/* Daily scan counter. The upgrade prompt only appears once the paywall is switched on. */}
            {subStatus && subStatus.dailyLimit != null && step === "upload" && (() => {
              const left = subStatus.scansRemaining ?? 0;
              const canUpgrade = subStatus.plan === "free" && subStatus.paywallEnabled;
              return (
                <div className="mt-4 space-y-2">
                  {left === 1 && canUpgrade && (
                    <div className="bg-sand/20 border border-sand text-sand-dark rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>This is your last free scan today. Upgrade for more scans.</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                      left === 0 ? "bg-coral-light/40 text-coral" : left === 1 ? "bg-sand text-sand-dark" : "bg-muted text-muted-foreground"
                    }`}>
                      {left === 0 ? (
                        <><Lock className="w-3 h-3" /> No scans left today. They reset tomorrow, and manual logging still works</>
                      ) : (
                        <><Sparkles className="w-3 h-3" /> {left} of {subStatus.dailyLimit} scans left today</>
                      )}
                    </div>
                    {left === 0 && canUpgrade && (
                      <button onClick={() => setShowPaywall(true)} className="text-xs text-primary font-medium hover:underline">
                        Upgrade
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
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
