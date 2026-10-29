import type { Express, Request, Response } from "express";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import {
  getDosesByUser, getEntitlement, getFitnessDataInRange, getLabResults, getMealsInRange, getReintroChallenges,
  getSupplementHistory, getSupplements, getSymptomsByUser, getUserById, getWaistLogs,
} from "../db";
import { hasFeature } from "../../shared/plans";
import { confirmationFor, type FinishedChallenge } from "../../shared/triggerConfirm";
import { LOOKBACK_DAYS, loadTriggers } from "../triggerInsights";
import { buildReport, type ReportInput } from "./model";
import { renderReportPdf } from "./pdf";

const DAY = 86_400_000;
export const REPORT_DAYS = [7, 14, 30, 60, 90] as const;

/** Reads everything the report needs for one person. Labs and protocol follow the plan, like the rest of the app. */
export async function loadReportInput(userId: number, days: number, tzOffsetMinutes: number, now = Date.now()): Promise<ReportInput> {
  const from = now - days * DAY;
  const key = (ts: number) => new Date(ts - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
  const [user, ent] = await Promise.all([getUserById(userId), getEntitlement(userId)]);
  const includeLabs = hasFeature(ent.plan, "labs", ENV.paywallEnabled);
  const includeProtocol = hasFeature(ent.plan, "protocol", ENV.paywallEnabled);

  const [meals, symptoms, fitness, waists, doses, supplements, suppHist, labs, challenges, found] = await Promise.all([
    getMealsInRange(userId, from, now),
    getSymptomsByUser(userId, 1500),
    getFitnessDataInRange(userId, from, now),
    getWaistLogs(userId, from),
    includeProtocol ? getDosesByUser(userId, 500) : Promise.resolve([]),
    includeProtocol ? getSupplements(userId) : Promise.resolve([]),
    includeProtocol ? getSupplementHistory(userId, key(from), key(now)) : Promise.resolve({ names: new Map<number, string>(), logs: [] as Array<{ supplementId: number; dateKey: string }> }),
    includeLabs ? getLabResults(userId) : Promise.resolve([]),
    getReintroChallenges(userId),
    loadTriggers(userId, now),
  ]);

  return {
    generatedAt: now, from, to: now, tzOffsetMinutes,
    name: user?.name ?? null,
    includeLabs, includeProtocol,
    meals: meals.map(m => ({ mealType: m.mealType, foods: m.foods, loggedAt: m.loggedAt, notes: m.notes })),
    symptoms: symptoms.map(s => ({ type: s.type, severity: s.severity, loggedAt: s.loggedAt, notes: s.notes })),
    weights: fitness.weights, waists, intake: fitness.intake, lifts: fitness.lifts,
    doses: doses.map(d => ({ compound: d.compound, doseMcg: d.doseMcg, site: d.site, loggedAt: d.loggedAt })),
    supplements: supplements.map(s => ({ id: s.id, name: s.name, dose: s.dose })),
    supplementLogs: suppHist.logs,
    labs: labs.map(l => ({ marker: l.marker, value: l.value, unit: l.unit, refLow: l.refLow, refHigh: l.refHigh, drawnOn: l.drawnOn })),
    challenges: challenges.map(c => ({ foodGroup: c.foodGroup, testFood: c.testFood, status: c.status, outcome: c.outcome, lowConfidence: c.lowConfidence, startedAt: c.startedAt, finishedAt: c.finishedAt })),
    triggers: found.triggers.map(t => ({ ...t, confirmation: confirmationFor(t.names, challenges as FinishedChallenge[]) })),
    triggerLookbackDays: LOOKBACK_DAYS,
  };
}

export function parseReportQuery(q: { days?: unknown; tz?: unknown }): { days: number; tz: number } {
  const d = Number(q.days);
  const days = (REPORT_DAYS as readonly number[]).includes(d) ? d : 30;
  const t = Math.trunc(Number(q.tz));
  const tz = Number.isFinite(t) && t >= -840 && t <= 840 ? t : 0;
  return { days, tz };
}

const recent = new Map<number, number[]>();
/** At most 6 reports a minute per person; building one touches a lot of tables. */
export function allowReport(userId: number, now = Date.now()): boolean {
  const hits = (recent.get(userId) ?? []).filter(t => now - t < 60_000);
  if (hits.length >= 6) { recent.set(userId, hits); return false; }
  recent.set(userId, [...hits, now]);
  return true;
}

export function registerReportRoute(app: Express) {
  app.get("/api/report.pdf", async (req: Request, res: Response) => {
    let userId: number;
    try { userId = (await sdk.authenticateRequest(req)).id; } catch { res.status(401).type("text/plain").send("Sign in to download your report."); return; }
    if (!allowReport(userId)) { res.status(429).type("text/plain").send("Please wait a minute and try again."); return; }
    try {
      const { days, tz } = parseReportQuery(req.query);
      const input = await loadReportInput(userId, days, tz);
      const pdf = await renderReportPdf(buildReport(input));
      const stamp = new Date(input.generatedAt - tz * 60_000).toISOString().slice(0, 10);
      res.status(200)
        .set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="triggerplate-report-${stamp}.pdf"`, "Cache-Control": "private, no-store" })
        .send(pdf);
    } catch (err) {
      console.error("[report] failed:", err instanceof Error ? err.message : err);
      res.status(500).type("text/plain").send("Could not build the report. Please try again.");
    }
  });
}
