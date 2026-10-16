// GutSync — Progress Page
// Protein / water targets, weigh-ins, and lift tracking.

import { motion } from "framer-motion";
import { formatGal, formatGalTarget, galInputValue, galToMl, mlToOz, ozToMl } from "@/lib/units";
import { useMemo, useState } from "react";
import { Beef, Droplets, Scale, Dumbbell, Trash2, Settings2, TrendingDown, TrendingUp, AlertTriangle, Loader2, Wheat, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProtocolCard from "@/components/ProtocolCard";
import WeeklySummaryCard from "@/components/WeeklySummaryCard";
import SupplementChecklist from "@/components/SupplementChecklist";
import LabsPanel from "@/components/LabsPanel";
import { readFiberPref, writeFiberPref } from "@/components/TodayCard";
import { weightTrend, doseMarkers } from "@shared/weekly";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip,
} from "recharts";
import { fmtMg } from "@shared/dose";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

const PRIMARY = "oklch(0.55 0.1 155)";
const CORAL = "oklch(0.7 0.12 25)";
const MUTED = "oklch(0.75 0.04 80)";

function shortDate(date: string) {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function ProgressBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
  return (
    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <motion.section variants={item} className="bg-card border border-border/60 rounded-2xl p-4 mb-4">{children}</motion.section>;
}

function CardTitle({ icon: Icon, title, right }: { icon: React.ElementType; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {right}
    </div>
  );
}

type TabId = "today" | "body" | "protocol" | "nutrition" | "labs";
const TABS: { id: TabId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "body", label: "Body" },
  { id: "protocol", label: "Protocol" },
  { id: "nutrition", label: "Nutrition" },
  { id: "labs", label: "Labs" },
];
const TAB_KEY = "gutsync_progress_tab";
function readTab(): TabId {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return TABS.some(t => t.id === v) ? (v as TabId) : "today";
  } catch { return "today"; }
}

const inputCls =
  "bg-background border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function Progress() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const tzOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);

  const summaryQuery = trpc.fitness.summary.useQuery(
    { days: 28, tzOffsetMinutes },
    { enabled: isAuthenticated },
  );
  const refresh = () => utils.fitness.summary.invalidate();

  const logIntake = trpc.fitness.logIntake.useMutation({ onSuccess: refresh });
  const deleteIntake = trpc.fitness.deleteIntake.useMutation({ onSuccess: refresh });
  const logWeight = trpc.fitness.logWeight.useMutation({ onSuccess: refresh });
  const deleteWeight = trpc.fitness.deleteWeight.useMutation({ onSuccess: refresh });
  const waistsQuery = trpc.fitness.waists.useQuery(undefined, { enabled: isAuthenticated });
  const doseQuery = trpc.dose.list.useQuery(undefined, { enabled: isAuthenticated });
  const logWaist = trpc.fitness.logWaist.useMutation({ onSuccess: () => utils.fitness.waists.invalidate() });
  const deleteWaist = trpc.fitness.deleteWaist.useMutation({ onSuccess: () => utils.fitness.waists.invalidate() });
  const logLift = trpc.fitness.logLift.useMutation({ onSuccess: refresh });
  const deleteLift = trpc.fitness.deleteLift.useMutation({ onSuccess: refresh });
  const setProfile = trpc.fitness.setProfile.useMutation({
    onSuccess: () => {
      refresh();
      utils.fitness.profile.invalidate();
    },
  });

  const [customProtein, setCustomProtein] = useState("");
  const [waistInput, setWaistInput] = useState("");
  const [fiberOnToday, setFiberOnToday] = useState(() => readFiberPref());
  const [weightInput, setWeightInput] = useState("");
  const [lift, setLift] = useState({ exercise: "", weightLb: "", reps: "", sets: "" });
  const [showTargets, setShowTargets] = useState(false);
  const [tab, setTabState] = useState<TabId>(() => readTab());
  const [bodyView, setBodyView] = useState<"weight" | "strength">("weight");
  const setTab = (t: TabId) => {
    setTabState(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* storage unavailable */ }
  };
  const [targets, setTargets] = useState({ protein: "", water: "" });

  const data = summaryQuery.data;
  const today = data?.today;
  const proteinTarget = data?.targets.proteinTargetG ?? 150;
  const waterTarget = data?.targets.waterTargetMl ?? 3785;

  const last14 = useMemo(() => (data?.days ?? []).slice(-14), [data]);
  const weightSeries = useMemo(
    () => (data?.days ?? []).filter(d => d.weightLb !== null).map(d => ({ date: d.date, weightLb: d.weightLb })),
    [data],
  );
  // Full day range (so dose markers always have a date to sit on), with the 7-day average per weigh-in.
  const trend = useMemo(() => weightTrend(data?.days ?? []), [data]);
  const markers = useMemo(() => {
    const first = data?.days?.[0]?.date;
    return doseMarkers(doseQuery.data?.doses ?? [], tzOffsetMinutes).filter(m => !!first && m.date >= first);
  }, [data, doseQuery.data, tzOffsetMinutes]);
  const knownExercises = useMemo(() => (data?.lifts ?? []).map(l => l.exercise), [data]);
  const proteinDaysHit = last14.filter(d => d.proteinG >= proteinTarget).length;

  const addIntake = (kind: "protein" | "water", amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    logIntake.mutate(
      { kind, amount: Math.round(amount) },
      {
        onSuccess: () => toast.success(kind === "protein" ? `+${Math.round(amount)} g protein` : `+${mlToOz(amount)} oz water`),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const submitWeight = () => {
    const w = Number(weightInput);
    if (!Number.isFinite(w) || w < 50) return toast.error("Enter your weight in lb");
    logWeight.mutate(
      { weightLb: w },
      {
        onSuccess: () => {
          setWeightInput("");
          toast.success(`Logged ${w} lb`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const submitWaist = () => {
    const w = Number(waistInput);
    if (!Number.isFinite(w) || w < 15 || w > 80) return toast.error("Enter your waist in inches");
    logWaist.mutate({ waistIn: w }, {
      onSuccess: () => { setWaistInput(""); toast.success(`Logged ${w} in`); },
      onError: (e) => toast.error(e.message),
    });
  };

  const submitLift = () => {
    const weightLb = Number(lift.weightLb);
    const reps = Number(lift.reps);
    const sets = lift.sets ? Number(lift.sets) : undefined;
    if (!lift.exercise.trim()) return toast.error("Enter an exercise");
    if (!Number.isInteger(weightLb) || weightLb < 0) return toast.error("Weight must be a whole number of lb");
    if (!Number.isInteger(reps) || reps < 1) return toast.error("Reps must be at least 1");
    logLift.mutate(
      { exercise: lift.exercise.trim(), weightLb, reps, ...(sets ? { sets } : {}) },
      {
        onSuccess: () => {
          setLift({ exercise: lift.exercise, weightLb: "", reps: "", sets: lift.sets });
          toast.success(`${lift.exercise.trim()} logged`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const saveTargets = () => {
    const proteinTargetG = Number(targets.protein || proteinTarget);
    const waterGal = Number(targets.water);
    const waterTargetMl = Number.isFinite(waterGal) && waterGal > 0 ? galToMl(waterGal) : waterTarget;
    if (waterTargetMl < 500 || waterTargetMl > 10000) return toast.error("Water target must be between 0.15 and 2.6 gal");
    setProfile.mutate(
      { proteinTargetG: Math.round(proteinTargetG), waterTargetMl: Math.round(waterTargetMl) },
      {
        onSuccess: () => {
          setShowTargets(false);
          toast.success("Targets saved");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  if (summaryQuery.isLoading) {
    return (
      <div className="flex justify-center pt-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const weeklyChange = data?.weeklyChangePct ?? null;
  const losingTooFast = weeklyChange !== null && weeklyChange < -1;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <motion.div variants={item} className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl tracking-tight">Progress</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Protein, hydration, weight and protocol</p>
        </div>
        <button
          onClick={() => {
            setTargets({ protein: String(proteinTarget), water: galInputValue(waterTarget) });
            setShowTargets(v => !v);
          }}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
          title="Edit targets"
        >
          <Settings2 className="w-5 h-5 text-muted-foreground" />
        </button>
      </motion.div>

      {showTargets && (
        <Card>
          <CardTitle icon={Settings2} title="Daily targets" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="text-xs text-muted-foreground">
              Protein (g)
              <input className={`${inputCls} mt-1`} type="number" inputMode="numeric" value={targets.protein}
                onChange={e => setTargets(t => ({ ...t, protein: e.target.value }))} />
            </label>
            <label className="text-xs text-muted-foreground">
              Water (gal)
              <input className={`${inputCls} mt-1`} type="number" inputMode="decimal" step="0.05" value={targets.water}
                onChange={e => setTargets(t => ({ ...t, water: e.target.value }))} />
            </label>
          </div>
          <Button className="w-full" onClick={saveTargets} disabled={setProfile.isPending}>Save targets</Button>
        </Card>
      )}

      <motion.div variants={item} role="tablist" aria-label="Progress sections"
        className="sticky top-0 z-10 -mx-4 px-4 py-2 mb-3 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="grid grid-cols-5 gap-0.5 bg-muted/60 rounded-xl p-1">
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Today */}
      {tab === "today" && (<>
      <Card>
        <CardTitle icon={Beef} title="Protein today" right={
          <span className="text-sm font-semibold">{today?.proteinG ?? 0}<span className="text-muted-foreground font-normal"> / {proteinTarget} g</span></span>
        } />
        <ProgressBar value={today?.proteinG ?? 0} target={proteinTarget} color={PRIMARY} />
        <p className="text-[11px] text-muted-foreground mt-1.5">Includes AI estimates from scanned meals plus quick adds.</p>
        <div className="flex gap-2 mt-3">
          {[20, 30, 50].map(g => (
            <Button key={g} variant="outline" size="sm" className="flex-1" onClick={() => addIntake("protein", g)} disabled={logIntake.isPending}>
              +{g} g
            </Button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input className={inputCls} type="number" inputMode="numeric" placeholder="Custom grams"
            value={customProtein} onChange={e => setCustomProtein(e.target.value)} />
          <Button size="sm" onClick={() => { addIntake("protein", Number(customProtein)); setCustomProtein(""); }}>Add</Button>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Water</span>
            </div>
            <span className="text-sm font-semibold">{formatGal(today?.waterMl ?? 0)}<span className="text-muted-foreground font-normal"> / {formatGalTarget(waterTarget)} gal</span></span>
          </div>
          <ProgressBar value={today?.waterMl ?? 0} target={waterTarget} color="oklch(0.6 0.1 230)" />
          <div className="flex gap-2 mt-3">
            {[8, 16, 24].map(oz => (
              <Button key={oz} variant="outline" size="sm" className="flex-1" onClick={() => addIntake("water", ozToMl(oz))} disabled={logIntake.isPending}>
                +{oz} oz
              </Button>
            ))}
          </div>
        </div>

        {(data?.recentIntake?.length ?? 0) > 0 && (
          <div className="mt-4 border-t border-border/60 pt-3 space-y-1.5">
            {data!.recentIntake.slice(0, 4).map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{e.kind === "protein" ? `${e.amount} g protein` : `${mlToOz(e.amount)} oz water`} · {new Date(e.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                <button onClick={() => deleteIntake.mutate({ id: e.id })} title="Undo"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <motion.div variants={item}><WeeklySummaryCard /></motion.div>
      </>)}

      {tab === "protocol" && (<>
      <motion.div variants={item}><ProtocolCard /></motion.div>
      <motion.div variants={item}><SupplementChecklist /></motion.div>
      </>)}

      {tab === "nutrition" && (<>
      {/* Fiber (rough estimate from logged meals) */}
      <Card>
        <div id="fiber" />
        <CardTitle icon={Wheat} title="Fiber (estimate)" right={
          <span className="text-sm font-semibold">~{data?.fiber.todayG ?? 0}<span className="text-muted-foreground font-normal"> g today</span></span>
        } />
        {data?.fiber.avg7 != null ? (
          <p className="text-sm">
            7-day average <span className="font-semibold">~{data.fiber.avg7} g</span>
            <span className="text-muted-foreground"> over {data.fiber.daysCounted} days · typical reference 25–38 g</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Needs at least 2 days of meals logged after this feature arrived to show an average.</p>
        )}
        {data?.fiber.avg7 != null && data.fiber.daysCounted >= 3 && data.fiber.avg7 < 20 && (
          <p className="text-xs text-muted-foreground mt-2">Your logged meals average below the typical range. Low fiber can add to constipation, and eating much less overall can too. Worth raising with your doctor or a dietitian if it persists.</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">Rough AI estimate from photos and typed meals. Packaged items with no fiber data aren't counted, so the real number is likely higher.</p>
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={fiberOnToday}
            onChange={e => { setFiberOnToday(e.target.checked); writeFiberPref(e.target.checked); }}
          />
          Show fiber on the Today card
        </label>
      </Card>

      {/* Protein history */}
      <Card>
        <CardTitle icon={Beef} title="Protein — last 14 days" right={
          <span className="text-xs text-muted-foreground">{proteinDaysHit}/14 days on target</span>
        } />
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last14} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10 }} interval={2} axisLine={false} tickLine={false} />
              <YAxis domain={[0, (max: number) => Math.ceil((Math.max(max, proteinTarget) * 1.1) / 50) * 50]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`${v} g`, "Protein"]} labelFormatter={shortDate} />
              <ReferenceLine y={proteinTarget} stroke={CORAL} strokeDasharray="4 4" />
              <Bar dataKey="proteinG" fill={PRIMARY} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      </>)}

      {tab === "body" && (
      <div className="flex gap-1 mb-3 text-xs">
        {(["weight", "strength"] as const).map(v => (
          <button key={v} onClick={() => setBodyView(v)}
            className={`px-3 py-1.5 rounded-full font-medium border transition-colors ${
              bodyView === v ? "bg-primary text-primary-foreground border-primary" : "bg-muted/60 text-muted-foreground border-transparent"}`}>
            {v === "weight" ? "Weight & waist" : "Strength"}
          </button>
        ))}
      </div>
      )}

      {/* Weight */}
      {tab === "body" && bodyView === "weight" && (
      <Card>
        <CardTitle icon={Scale} title="Weight" right={
          weeklyChange !== null ? (
            <span className={`text-xs font-medium flex items-center gap-1 ${losingTooFast ? "text-coral" : "text-muted-foreground"}`}>
              {weeklyChange < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              {weeklyChange > 0 ? "+" : ""}{weeklyChange}% / wk
            </span>
          ) : null
        } />
        <div className="flex gap-2">
          <input className={inputCls} type="number" inputMode="decimal" step="0.1" placeholder="Morning weight (lb)"
            value={weightInput} onChange={e => setWeightInput(e.target.value)} />
          <Button size="sm" onClick={submitWeight} disabled={logWeight.isPending}>Log</Button>
        </div>
        {losingTooFast && (
          <p className="text-xs text-coral mt-2 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Losing more than ~1% per week. Faster loss raises the risk of losing muscle — check protein and strength trends.
          </p>
        )}
        {weightSeries.length >= 2 ? (
          <>
            <div className="h-40 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10 }} interval={6} axisLine={false} tickLine={false} />
                  <YAxis domain={[(min: number) => Math.floor(min - 2), (max: number) => Math.ceil(max + 2)]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number, name: string) => [`${v} lb`, name === "avg" ? "7-day avg" : "Weigh-in"]} labelFormatter={shortDate} />
                  {markers.map((m, i) => (
                    <ReferenceLine key={`${m.date}-${m.compound}-${i}`} x={m.date} stroke={m.kind === "start" ? PRIMARY : CORAL} strokeDasharray="3 3" />
                  ))}
                  <Line type="monotone" dataKey="weightLb" stroke="none" dot={{ r: 2.5, fill: MUTED, stroke: "none" }} activeDot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="avg" stroke={PRIMARY} strokeWidth={2.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Dots are weigh-ins; the line is the 7-day average. Dashed lines mark a dose start (green) or change (orange).</p>
            {markers.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {markers.slice(-4).map((m, i) => (
                  <li key={`${m.date}-${i}`} className="text-[11px] text-muted-foreground">
                    <span style={{ color: m.kind === "start" ? PRIMARY : CORAL }}>●</span> {shortDate(m.date)} · {m.kind === "start" ? "started" : "changed to"} {m.compound} {fmtMg(m.doseMcg)}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground mt-3">Log at least two weigh-ins to see a trend.</p>
        )}
        {(data?.recentWeights?.length ?? 0) > 0 && (
          <div className="mt-3 space-y-1.5">
            {data!.recentWeights.slice(0, 3).map(w => (
              <div key={w.id} className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{w.weightLb} lb · {new Date(w.loggedAt).toLocaleDateString()}</span>
                <button onClick={() => deleteWeight.mutate({ id: w.id })} title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Waist (optional) */}
        <div className="mt-4 border-t border-border/60 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Ruler className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Waist</span>
            <span className="text-[11px] text-muted-foreground">optional · helps tell fat loss from muscle loss</span>
          </div>
          <div className="flex gap-2">
            <input className={inputCls} type="number" inputMode="decimal" step="0.1" placeholder="Waist at navel (in)"
              value={waistInput} onChange={e => setWaistInput(e.target.value)} />
            <Button size="sm" onClick={submitWaist} disabled={logWaist.isPending}>Log</Button>
          </div>
          {(waistsQuery.data?.length ?? 0) > 0 && (() => {
            const w = waistsQuery.data!;
            const change = w.length >= 2 ? Math.round((w[0].waistIn - w[w.length - 1].waistIn) * 10) / 10 : null;
            return (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Latest <span className="font-semibold text-foreground">{w[0].waistIn} in</span>
                  {change !== null && <> · {change > 0 ? "+" : ""}{change} in since {new Date(w[w.length - 1].loggedAt).toLocaleDateString()}</>}
                </p>
                {w.slice(0, 3).map(x => (
                  <div key={x.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{x.waistIn} in · {new Date(x.loggedAt).toLocaleDateString()}</span>
                    <button onClick={() => deleteWaist.mutate({ id: x.id })} title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </Card>

      )}

      {/* Lifts */}
      {tab === "body" && bodyView === "strength" && (
      <Card>
        <CardTitle icon={Dumbbell} title="Strength" />
        <div className="space-y-2">
          <input className={inputCls} list="known-exercises" placeholder="Exercise (e.g. Bench press)"
            value={lift.exercise} onChange={e => setLift(l => ({ ...l, exercise: e.target.value }))} />
          <datalist id="known-exercises">
            {knownExercises.map(x => <option key={x} value={x} />)}
          </datalist>
          <div className="grid grid-cols-3 gap-2">
            <input className={inputCls} type="number" inputMode="numeric" placeholder="lb"
              value={lift.weightLb} onChange={e => setLift(l => ({ ...l, weightLb: e.target.value }))} />
            <input className={inputCls} type="number" inputMode="numeric" placeholder="reps"
              value={lift.reps} onChange={e => setLift(l => ({ ...l, reps: e.target.value }))} />
            <input className={inputCls} type="number" inputMode="numeric" placeholder="sets"
              value={lift.sets} onChange={e => setLift(l => ({ ...l, sets: e.target.value }))} />
          </div>
          <Button className="w-full" onClick={submitLift} disabled={logLift.isPending}>Log top set</Button>
        </div>

        {(data?.lifts?.length ?? 0) > 0 ? (
          <div className="mt-4 space-y-3">
            {data!.lifts.map(l => {
              const latest = l.series[l.series.length - 1];
              const dropping = l.series.length >= 2 && l.changePct <= -5;
              return (
                <div key={l.exercise} className="bg-muted/50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{l.exercise}</span>
                    <span className="text-xs text-muted-foreground">
                      {latest.weightLb} lb × {latest.reps} · e1RM {latest.e1rm}
                    </span>
                  </div>
                  {l.series.length >= 2 && (
                    <>
                      <div className="h-14 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={l.series} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                            <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                            <Line type="monotone" dataKey="e1rm" stroke={dropping ? CORAL : PRIMARY} strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className={`text-[11px] mt-1 ${dropping ? "text-coral" : "text-muted-foreground"}`}>
                        {l.changePct > 0 ? "+" : ""}{l.changePct}% estimated 1RM over 4 weeks
                        {dropping ? " — strength is dropping; review protein and recovery" : ""}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-3">Log your top set for each main lift to track strength through the cut.</p>
        )}

        {(data?.recentLifts?.length ?? 0) > 0 && (
          <div className="mt-4 border-t border-border/60 pt-3 space-y-1.5">
            {data!.recentLifts.slice(0, 5).map(l => (
              <div key={l.id} className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{l.exercise} · {l.weightLb}×{l.reps}{l.sets > 1 ? ` ×${l.sets}` : ""} · {new Date(l.loggedAt).toLocaleDateString()}</span>
                <button onClick={() => deleteLift.mutate({ id: l.id })} title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </Card>
      )}

      {tab === "labs" && <LabsPanel />}
    </motion.div>
  );
}
