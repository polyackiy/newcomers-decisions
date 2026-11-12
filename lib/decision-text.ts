import type { Action, Employee } from "./contracts";
export function buildPlanText(
  employee: Pick<Employee, "fullName" | "role"> | undefined,
  action: Action,
) {
  const date = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(action.dueOn + "T00:00:00Z"));
  const latest = action.history?.at(-1);
  const followUp =
    action.status === "open" && latest?.kind === "reopened"
      ? `\n\nЧто ещё нужно проверить:\n${latest.reason}`
      : "";
  return `${employee?.fullName ?? action.employeeId} · ${employee?.role ?? ""}\n\n${action.title}${followUp}\n\nОтветственный: ${action.owner}\nСрок: ${date}`;
}
