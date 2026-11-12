import type { Dataset, Employee, Metrics } from "./contracts";
export const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000,
  );
export const isPlanned = (e: Employee) =>
  e.employmentIntent === "temporary" &&
  !!e.plannedEndOn &&
  e.plannedEndOn === e.endedOn &&
  e.exitOutcome === "planned_completion" &&
  !!e.exitRecordId;
export function calculateMetrics(d: Dataset): Metrics {
  const mature = d.employees.filter(
    (e) => daysBetween(e.startedOn, d.asOf) >= 90,
  );
  const permanent = mature.filter((e) => e.employmentIntent === "permanent");
  const early = (e: Employee) =>
    !!e.endedOn && daysBetween(e.startedOn, e.endedOn) < 90;
  const earlyPermanent = permanent.filter(early).length;
  return {
    total: d.employees.length,
    mature: mature.length,
    recent: d.employees.length - mature.length,
    maturePermanent: permanent.length,
    earlyPermanent,
    confirmedPlanned: mature.filter(isPlanned).length,
    unresolvedEarly: mature.filter(
      (e) => early(e) && e.employmentIntent !== "permanent" && !isPlanned(e),
    ).length,
    earlyPermanentRate: permanent.length
      ? earlyPermanent / permanent.length
      : null,
  };
}
