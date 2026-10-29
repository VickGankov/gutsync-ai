// Body tab: weight with a smoothed trend, honest pace, optional goal and ETA, and waist.
// The big number is the trend, not today's scale reading, because one weigh-in is mostly water and food.

import { useMemo, useState } from "react";
import { AlertTriangle, Ruler, Scale, Target, Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { TONE, tint } from "@/lib/tones";
import { fmtMg } from "@shared/dose";
import { doseMarkers } from "@shared/weekly";
import { addDays, aroundChanges, dayNum, goalEta, rateBetween, recentRate, trendSeries, type WeighIn } from "@shared/bodyTrend";

const DAY_MS = 86_400_000;
const INK = TONE.weight.ink;
const dateOf = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const md = (date: string) => { const [, m, d] = date.split("-"); return `${Number(m)}/${Number(d)}`; };
const long = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const inputCls = "bg-background border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30";

export interface WeightCardProps {
  days: Array<{ date: string; weightLb: number | null; proteinG: number }>;
  recentWeights: Array<{ id: number; weightLb: number; loggedAt: number }>;
  targets: { proteinTargetG: number; waterTargetMl: number; goalWeightLb: number | null };
  tzOffsetMinutes: number;
  onChanged: () => void;
}

export default function WeightCard({ days, recentWeights, targets, tzOffsetMinutes, onChanged }: WeightCardProps) {
  const utils = trpc.useUtils();
  const doseQuery = trpc.dose.list.useQuery(undefined, { retry: false });
  const waistsQuery = trpc.fitness.waists.useQuery();
  const logWeight = trpc.fitness.logWeight.useMutation({ onSuccess: onChanged });
  const deleteWeight = trpc.fitness.deleteWeight.useMutation({ onSuccess: onChanged });
  const setProfile = trpc.fitness.setProfile.useMutation({ onSuccess: () => { onChanged(); utils.fitness.profile.invalidate(); } });
  const logWaist = trpc.fitness.logWaist.useMutation({ onSuccess: () => utils.fitness.waists.invalidate() });
  const deleteWaist = trpc.fitness.deleteWaist.useMutation({ onSuccess: () => utils.fitness.waists.invalidate() });

  const [weightInput, setWeightInput] = useState("");
  const [waistInput, setWaistInput] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [editGoal, setEditGoal] = useState(false);
  const [range, setRange] = useState<28 | 84>(28);

  const today = days[days.length - 1]?.date ?? new Date().toISOString().slice(0, 10);
  const weighIns: WeighIn[] = useMemo(
    () => days.filter(d => d.weightLb !== null).map(d => ({ date: d.date, lb: d.weightLb as number })),
    [days],
  );
  const trend = useMemo(() => trendSeries(weighIns), [weighIns]);
  const latest = trend[trend.length - 1];
  const rate = useMemo(() => recentRate(weighIns, 14), [weighIns]);
  const rate28 = useMemo(() => rateBetween(weighIns, addDays(today, -27), today, 5, 14), [weighIns, today]);

  const goal = targets.goalWeightLb;
  const eta = useMemo(
    () => (goal && latest ? goalEta(latest.trend, goal, [rate, rate28], today) : null),
    [goal, latest, rate, rate28, today],
  );

  const markers = useMemo(() => doseMarkers(doseQuery.data?.doses ?? [], tzOffsetMinutes), [doseQuery.data, tzOffsetMinutes]);
  const windows = useMemo(
    () => aroundChanges({ markers, weighIns, days, today }),
    [markers, weighIns, days, today],
  );

  // Chart: numeric x so the line starts at the first weigh-in shown instead of leaving empty space.
  const shown = useMemo(() => {
    const from = addDays(today, -(range - 1));
    return trend.filter(t => t.date >= from).map(t => ({ x: dayNum(t.date), date: t.date, lb: t.lb, trend: t.trend }));
  }, [trend, range, today]);
  const xMin = shown.length ? shown[0].x : dayNum(today) - 6;
  const xMax = dayNum(today);
  const ticks = useMemo(() => {
    const span = Math.max(1, xMax - xMin), n = Math.min(4, Math.max(2, Math.floor(span / 5) + 1));
    return Array.from({ length: n }, (_, i) => Math.round(xMin + (span * i) / (n - 1)));
  }, [xMin, xMax]);
  const lbs = shown.flatMap(s => [s.lb, s.trend]).concat(goal && goal >= Math.min(...shown.map(s => s.lb)) - 6 && goal <= Math.max(...shown.map(s => s.lb)) + 6 ? [goal] : []);
  const yMin = shown.length ? Math.floor(Math.min(...lbs) - 1) : 0;
  const yMax = shown.length ? Math.ceil(Math.max(...lbs) + 1) : 1;
  const bands = windows.filter(w => dayNum(w.end) >= xMin);

  const submitWeight = () => {
    const w = Number(weightInput);
    if (!Number.isFinite(w) || w < 50) return toast.error("Enter your weight in lb");
    logWeight.mutate({ weightLb: w }, {
      onSuccess: () => { setWeightInput(""); toast.success(`Logged ${w} lb`); },
      onError: e => toast.error(e.message),
    });
  };
  const submitWaist = () => {
    const w = Number(waistInput);
    if (!Number.isFinite(w) || w < 15 || w > 80) return toast.error("Enter your waist in inches");
    logWaist.mutate({ waistIn: w }, {
      onSuccess: () => { setWaistInput(""); toast.success(`Logged ${w} in`); },
      onError: e => toast.error(e.message),
    });
  };
  const saveGoal = (clear = false) => {
    const g = Number(goalInput);
    if (!clear && (!Number.isFinite(g) || g < 80 || g > 600)) return toast.error("Enter a goal weight in lb");
    setProfile.mutate(
      { proteinTargetG: targets.proteinTargetG, waterTargetMl: targets.waterTargetMl, goalWeightLb: clear ? null : g },
      { onSuccess: () => { setEditGoal(false); setGoalInput(""); toast.success(clear ? "Goal removed" : "Goal saved"); }, onError: e => toast.error(e.message) },
    );
  };

  const tooFast = !!rate && rate.pctPerWeek <= -1;
  const Arrow = !rate ? Minus : rate.lbPerWeek < -0.1 ? TrendingDown : rate.lbPerWeek > 0.1 ? TrendingUp : Minus;
  const offTrend = latest ? Math.round((latest.lb - latest.trend) * 10) / 10 : 0;

  return (
    <section className="bg-card border border-border/60 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Scale className="w-4 h-4" style={{ color: INK }} />
        <h2 className="text-sm font-semibold">Weight</h2>
      </div>

      {latest ? (
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-4xl leading-none">{latest.trend}<span className="text-base font-sans text-muted-foreground ml-1">lb</span></p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Trend weight · last weigh-in {latest.lb} lb{Math.abs(offTrend) >= 0.5 ? ` (${offTrend > 0 ? "+" : ""}${offTrend} vs trend, normal day-to-day swing)` : ""}
            </p>
          </div>
          <div className="text-right shrink-0">
            {rate ? (
              <p className={`text-sm font-semibold flex items-center justify-end gap-1 ${tooFast ? "text-coral" : ""}`}>
                <Arrow className="w-4 h-4" />{rate.lbPerWeek > 0 ? "+" : ""}{rate.lbPerWeek} lb/wk
              </p>
            ) : (
              <p className="text-xs text-muted-foreground max-w-[9rem]">Pace needs 4 weigh-ins over a week</p>
            )}
            {rate && <p className="text-[11px] text-muted-foreground">{rate.pctPerWeek > 0 ? "+" : ""}{rate.pctPerWeek}% a week · last 2 weeks</p>}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Log your weight to start a trend. Weigh at the same time each morning if you can.</p>
      )}

      {tooFast && (
        <p className="text-xs text-coral mt-3 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Losing more than about 1% a week. Faster loss makes losing muscle more likely, so check the muscle section below.
        </p>
      )}

      <div className="flex gap-2 mt-4">
        <input className={inputCls} type="number" inputMode="decimal" step="0.1" placeholder="Morning weight (lb)"
          value={weightInput} onChange={e => setWeightInput(e.target.value)} />
        <Button size="sm" onClick={submitWeight} disabled={logWeight.isPending}>Log</Button>
      </div>

      {shown.length >= 2 && (
        <>
          <div className="flex items-center justify-between mt-4 mb-1">
            <div className="flex gap-1 text-[11px]">
              {([28, 84] as const).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-2.5 py-1 rounded-full font-medium ${range === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {r === 28 ? "4 weeks" : "12 weeks"}
                </button>
              ))}
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={shown} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="oklch(0.9 0.01 80)" strokeDasharray="2 4" vertical={false} />
                <XAxis type="number" dataKey="x" domain={[xMin, xMax]} ticks={ticks} tickFormatter={n => md(dateOf(n))} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number, name: string) => [`${v} lb`, name === "trend" ? "Trend" : "Weigh-in"]}
                  labelFormatter={(n: number) => long(dateOf(n))}
                />
                {bands.map((w, i) => (
                  <ReferenceArea key={i} x1={Math.max(xMin, dayNum(w.start))} x2={Math.min(xMax, Math.max(dayNum(w.end), dayNum(w.start) + 0.5))}
                    fill={TONE.meals.ink} fillOpacity={0.22} stroke="none" />
                ))}
                {goal && goal >= yMin && goal <= yMax && <ReferenceLine y={goal} stroke={TONE.fiber.ink} strokeDasharray="5 4" label={{ value: "Goal", fontSize: 10, fill: TONE.fiber.ink, position: "insideTopRight" }} />}
                <Line dataKey="lb" stroke="none" dot={{ r: 2.5, fill: "oklch(0.72 0.04 80)", stroke: "none" }} activeDot={{ r: 4 }} isAnimationActive={false} />
                <Line dataKey="trend" stroke={INK} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Dots are weigh-ins; the line is your trend, which smooths out water and food swings.
            {bands.length > 0 && <> <span className="inline-block w-2.5 h-2.5 rounded-sm align-middle" style={{ background: tint(TONE.meals.ink, 45) }} /> Shaded bands mark when you started or changed a protocol dose.</>}
          </p>
          {bands.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {bands.slice(-3).map(w => (
                <li key={w.start} className="text-[11px] text-muted-foreground">
                  {md(w.start)}{w.end !== w.start ? `–${md(w.end)}` : ""} · {w.items.map(i => `${i.kind === "start" ? "started" : "changed"} ${i.compound} ${fmtMg(i.doseMcg)}`).join(", ")}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {latest && shown.length < 2 && <p className="text-xs text-muted-foreground mt-3">Log at least two weigh-ins to see a chart.</p>}

      {/* Goal */}
      {latest && (
        <div className="mt-4 rounded-xl px-3 py-2.5" style={{ background: tint(TONE.fiber.ink, 12) }}>
          {goal && !editGoal ? (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />Goal {goal} lb
                  {eta && eta.state !== "reached" && <span className="font-normal text-muted-foreground"> · {Math.abs(eta.remainingLb)} lb {eta.remainingLb < 0 ? "to lose" : "to gain"}</span>}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {eta?.state === "reached" && "You're at your goal."}
                  {eta?.state === "projected" && (eta.from === eta.to
                    ? `At your recent pace: around ${long(eta.from!)}.`
                    : `At your recent pace: roughly ${long(eta.from!)} to ${long(eta.to!)}. A guess that moves as your pace does.`)}
                  {eta?.state === "away" && "Your recent pace isn't heading toward the goal, so there's no date to project."}
                  {eta?.state === "unknown" && "A date appears once your pace is clear (4 weigh-ins over a week)."}
                </p>
              </div>
              <button className="text-[11px] font-semibold text-primary shrink-0" onClick={() => { setGoalInput(String(goal)); setEditGoal(true); }}>Edit</button>
            </div>
          ) : editGoal || !goal ? (
            <div>
              {!editGoal && !goal ? (
                <button className="text-xs font-semibold flex items-center gap-1.5" onClick={() => setEditGoal(true)}><Target className="w-3.5 h-3.5" />Set a goal weight</button>
              ) : (
                <div className="flex items-center gap-2">
                  <input className={inputCls} type="number" inputMode="decimal" step="0.1" placeholder="Goal weight (lb)" value={goalInput} onChange={e => setGoalInput(e.target.value)} autoFocus />
                  <Button size="sm" onClick={() => saveGoal()} disabled={setProfile.isPending}>Save</Button>
                  {goal && <Button size="sm" variant="outline" onClick={() => saveGoal(true)} disabled={setProfile.isPending}>Clear</Button>}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {recentWeights.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {recentWeights.slice(0, 3).map(w => (
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
          <Ruler className="w-4 h-4" style={{ color: INK }} />
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
    </section>
  );
}
