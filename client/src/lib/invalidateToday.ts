import type { trpc } from "@/lib/trpc";

/** Refresh everything the Today card and dashboard read, right after a meal or symptom changes. */
export function invalidateToday(utils: ReturnType<typeof trpc.useUtils>) {
  return Promise.all([
    utils.meals.list.invalidate(),
    utils.symptoms.list.invalidate(),
    utils.insights.dashboard.invalidate(),
    utils.fitness.summary.invalidate(),
    utils.reintro.list.invalidate(),
  ]);
}
