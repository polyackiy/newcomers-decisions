import { DatasetSchema, type Dataset } from "./contracts";
export const MAX_BYTES = 256 * 1024;
export function parseDataset(input: unknown): Dataset {
  const parsed = DatasetSchema.safeParse(input);
  if (!parsed.success) {
    const e = parsed.error.issues[0];
    throw new Error(`${e.path.join(".") || "Данные"}: ${e.message}`);
  }
  const d = parsed.data;
  if (new TextEncoder().encode(JSON.stringify(d)).length > MAX_BYTES)
    throw new Error("Размер данных больше 256 КиБ.");
  const employees = new Map(d.employees.map((e) => [e.id, e]));
  const records = new Map(d.records.map((r) => [r.id, r]));
  if (
    employees.size !== d.employees.length ||
    records.size !== d.records.length
  )
    throw new Error("ID сотрудников и записей должны быть уникальными.");
  if (d.records.reduce((s, r) => s + r.text.length, 0) > 40000)
    throw new Error("Суммарный текст записей больше 40 000 символов.");
  for (const e of d.employees) {
    if (e.startedOn > d.asOf)
      throw new Error(`${e.id}: выход позже даты среза.`);
    if (e.plannedEndOn && e.plannedEndOn < e.startedOn)
      throw new Error(`${e.id}: плановое завершение раньше выхода.`);
    if (e.endedOn && (e.endedOn < e.startedOn || e.endedOn > d.asOf))
      throw new Error(`${e.id}: некорректная дата ухода.`);
    if (
      Boolean(e.endedOn) !== Boolean(e.exitRecordId) ||
      Boolean(e.endedOn) !== Boolean(e.exitOutcome)
    )
      throw new Error(`${e.id}: для ухода нужны дата, исход и запись.`);
    const hire = records.get(e.hireRecordId);
    const exit = e.exitRecordId ? records.get(e.exitRecordId) : null;
    if (!hire || hire.employeeId !== e.id || hire.kind !== "hire")
      throw new Error(`${e.id}: неверная ссылка на приём.`);
    if (
      e.exitRecordId &&
      (!exit || exit.employeeId !== e.id || exit.kind !== "exit")
    )
      throw new Error(`${e.id}: неверная ссылка на уход.`);
  }
  for (const r of d.records) {
    const e = employees.get(r.employeeId);
    if (!e) throw new Error(`${r.id}: сотрудник не найден.`);
    if (r.createdOn > r.updatedOn || r.updatedOn > d.asOf)
      throw new Error(`${r.id}: некорректные даты записи.`);
    if (r.kind === "exit" && !e.endedOn)
      throw new Error(`${r.id}: запись ухода без даты ухода.`);
  }
  return d;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            canonical((value as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export async function datasetFingerprint(data: Dataset): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(data));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
