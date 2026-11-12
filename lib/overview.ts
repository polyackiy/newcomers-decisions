import type { CaseView, Dataset, Employee } from "./contracts";
import { daysBetween, isPlanned } from "./metrics";
export function groupEmployees(data: Dataset) {
  const groups = [
    {
      id: "retained",
      label: "Отработали 90 дней",
      employees: [] as Employee[],
    },
    { id: "early", label: "Ушли раньше 90 дней", employees: [] as Employee[] },
    {
      id: "planned",
      label: "Подработка завершена",
      employees: [] as Employee[],
    },
    {
      id: "recent",
      label: "Ещё не прошло 90 дней",
      employees: [] as Employee[],
    },
    {
      id: "other",
      label: "Нужна отдельная проверка",
      employees: [] as Employee[],
    },
  ];
  for (const e of data.employees) {
    const recent = daysBetween(e.startedOn, data.asOf) < 90;
    const early = !!e.endedOn && daysBetween(e.startedOn, e.endedOn) < 90;
    const group = recent
      ? "recent"
      : isPlanned(e)
        ? "planned"
        : !early
          ? "retained"
          : e.employmentIntent === "permanent"
            ? "early"
            : "other";
    groups.find((g) => g.id === group)!.employees.push(e);
  }
  return groups.filter((g) => g.employees.length);
}
export function overviewCounts(cases: CaseView[], asOf: string) {
  const open = cases.filter((c) => c.action?.status === "open");
  return {
    needsReview: cases.filter((c) => !c.action).length,
    inProgress: open.length,
    due: open.filter((c) => c.action!.dueOn <= asOf).length,
  };
}
