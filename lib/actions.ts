import { ActionSchema, type Action, type ActionDraft } from "./contracts";
export function acceptAction(
  draft: ActionDraft,
  existing: Action[],
  now: string,
): Action[] {
  const action = ActionSchema.parse({
    ...draft,
    id: crypto.randomUUID(),
    status: "open",
    outcome: null,
    createdAt: now,
    updatedAt: now,
  });
  if (
    existing.some(
      (a) =>
        a.status === "open" &&
        a.datasetFingerprint === action.datasetFingerprint &&
        a.employeeId === action.employeeId &&
        a.title === action.title,
    )
  )
    return existing;
  return [...existing, action];
}
function resolve(
  id: string,
  text: string,
  actions: Action[],
  now: string,
  status: "done" | "dismissed",
): Action[] {
  if (!text.trim())
    throw new Error(
      status === "done"
        ? "Укажите наблюдаемый результат."
        : "Укажите причину отказа.",
    );
  const current = actions.find((a) => a.id === id);
  if (!current || current.status !== "open")
    throw new Error("Открытое действие не найдено.");
  return actions.map((a) =>
    a.id === id ? { ...a, status, outcome: text.trim(), updatedAt: now } : a,
  );
}
export const completeAction = (
  id: string,
  text: string,
  actions: Action[],
  now: string,
) => resolve(id, text, actions, now, "done");
export const dismissAction = (
  id: string,
  text: string,
  actions: Action[],
  now: string,
) => resolve(id, text, actions, now, "dismissed");
const key = (fingerprint: string) => "newcomers:actions:v1:" + fingerprint;
function revise(
  id: string,
  text: string,
  actions: Action[],
  now: string,
  kind: "correction" | "reopened",
): Action[] {
  const current = actions.find((a) => a.id === id);
  if (!current || current.status === "open")
    throw new Error("Завершённое поручение не найдено.");
  const value = text.trim();
  if (!value)
    throw new Error(
      kind === "correction"
        ? "Укажите исправленный результат."
        : "Укажите, что ещё нужно проверить.",
    );
  if (value.length > 1200)
    throw new Error("Запись не должна превышать 1200 символов.");
  if (kind === "correction" && value === current.outcome) return actions;
  const next = ActionSchema.parse({
    ...current,
    status: kind === "reopened" ? "open" : current.status,
    outcome: kind === "reopened" ? null : value,
    updatedAt: now,
    history: [
      ...(current.history ?? []),
      {
        status: current.status,
        outcome: current.outcome,
        recordedAt: current.updatedAt,
        changedAt: now,
        kind,
        reason: kind === "correction" ? "Исправление записи" : value,
      },
    ],
  });
  return actions.map((a) => (a.id === id ? next : a));
}
export const correctOutcome = (
  id: string,
  text: string,
  actions: Action[],
  now: string,
) => revise(id, text, actions, now, "correction");
export const reopenAction = (
  id: string,
  text: string,
  actions: Action[],
  now: string,
) => revise(id, text, actions, now, "reopened");
export function loadActions(fingerprint: string): {
  actions: Action[];
  available: boolean;
} {
  try {
    const raw = localStorage.getItem(key(fingerprint));
    if (!raw) return { actions: [], available: true };
    const parsed = ActionSchema.array().parse(JSON.parse(raw));
    if (parsed.some((a) => a.datasetFingerprint !== fingerprint))
      throw new Error("Wrong dataset");
    return { actions: parsed, available: true };
  } catch {
    return { actions: [], available: false };
  }
}
export function saveActions(
  fingerprint: string,
  actions: Action[],
): { persisted: boolean } {
  try {
    if (actions.some((a) => a.datasetFingerprint !== fingerprint))
      return { persisted: false };
    localStorage.setItem(key(fingerprint), JSON.stringify(actions));
    return { persisted: true };
  } catch {
    return { persisted: false };
  }
}
