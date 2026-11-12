import {
  AnalysisSchema,
  type Dataset,
  type Analysis,
  type Action,
  type CaseView,
} from "./contracts";
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
export function validateEvidence(d: Dataset, input: unknown): Analysis {
  const a = AnalysisSchema.parse(input);
  const employees = new Set(d.employees.map((e) => e.id));
  const records = new Map(d.records.map((r) => [r.id, r]));
  if (a.findings.length > 100) throw new Error("Слишком много выводов.");
  for (const f of a.findings) {
    if (!employees.has(f.employeeId) || !f.observations.length)
      throw new Error("Вывод не связан с сотрудником или наблюдением.");
    for (const o of f.observations) {
      if (!o.text.trim() || !o.citations.length)
        throw new Error("Наблюдению нужно подтверждение.");
      for (const c of o.citations) {
        const r = records.get(c.recordId);
        if (
          !r ||
          r.employeeId !== f.employeeId ||
          !normalize(c.quote) ||
          !normalize(r.text).includes(normalize(c.quote))
        )
          throw new Error("AI привёл неподтверждённую ссылку или цитату.");
      }
    }
  }
  return a;
}
export function shouldApplyAnalysis(
  current: string,
  envelope: { datasetFingerprint: string },
) {
  return current === envelope.datasetFingerprint;
}
export function buildCaseViews(
  d: Dataset,
  analysis: unknown,
  actions: Action[],
  preservedEmployeeIds: string[] = [],
): CaseView[] {
  const findings = analysis ? validateEvidence(d, analysis).findings : [];
  const cases = d.employees.flatMap((e) => {
    const own = d.records.filter((r) => r.employeeId === e.id);
    const fs = findings.filter((f) => f.employeeId === e.id);
    const open = own.filter(
      (r) => r.kind === "adaptation" && r.status === "open",
    );
    const savedAction =
      actions.find((a) => a.employeeId === e.id && a.status === "open") ??
      actions.filter((a) => a.employeeId === e.id).at(-1) ??
      null;
    const relevant =
      savedAction ||
      preservedEmployeeIds.includes(e.id) ||
      (e.endedOn && e.exitOutcome !== "planned_completion") ||
      open.length ||
      fs.length;
    if (!relevant) return [];
    const hasOpenEvidence = fs.some(
      (f) =>
        ["access", "schedule"].includes(f.category) &&
        f.observations.some(
          (o) =>
            o.kind === "reported" &&
            o.citations.some((c) => open.some((r) => r.id === c.recordId)),
        ),
    );
    const priority: CaseView["priority"] =
      !e.endedOn && hasOpenEvidence
        ? "check_now"
        : fs.length
          ? "review"
          : "unknown";
    const access = fs.some((f) => f.category === "access");
    const wms = fs.some(
      (f) =>
        f.category === "access" &&
        f.observations.some((o) =>
          o.citations.some((c) => /\bWMS\b/i.test(c.quote)),
        ),
    );
    const schedule = fs.some((f) => f.category === "schedule");
    const title =
      priority === "check_now" && access
        ? wms
          ? "Проверить доступ к WMS"
          : "Проверить рабочий доступ"
        : schedule
          ? !e.endedOn
            ? (open.find((r) => r.title)?.title ?? "Проверить график работы")
            : "Сверить условия графика при найме"
          : e.endedOn
            ? "Уточнить обстоятельства ухода"
            : open.length
              ? "Проверить открытую задачу"
              : (savedAction?.title ?? "Проверить записи");
    return [
      {
        employeeId: e.id,
        title,
        priority,
        sourceRecordIds: own
          .filter(
            (r) =>
              r.kind !== "hire" ||
              preservedEmployeeIds.includes(e.id) ||
              fs.some((f) =>
                f.observations.some((o) =>
                  o.citations.some((c) => c.recordId === r.id),
                ),
              ),
          )
          .map((r) => r.id),
        findings: fs,
        action: savedAction,
      },
    ];
  });
  const order = { check_now: 0, review: 1, unknown: 2 };
  const updated = (c: CaseView) =>
    d.records
      .filter((r) => c.sourceRecordIds.includes(r.id))
      .map((r) => r.updatedOn)
      .sort()
      .at(-1) ?? "";
  return cases.sort(
    (a, b) =>
      order[a.priority] - order[b.priority] ||
      updated(b).localeCompare(updated(a)) ||
      a.employeeId.localeCompare(b.employeeId),
  );
}

/** Receives the ordered case list produced by buildCaseViews. */
export function selectPrimaryCase(cases: CaseView[]) {
  return cases.find((c) => !c.action || c.action.status === "open") ?? cases[0];
}
export function explainPriority(
  data: Dataset,
  item: CaseView,
  hasManagerUpdate = false,
) {
  const updatedOn =
    data.records
      .filter((r) => item.sourceRecordIds.includes(r.id))
      .map((r) => r.updatedOn)
      .sort()
      .at(-1) ?? null;
  if (item.action && item.action.status !== "open")
    return {
      kind: "completed" as const,
      updatedOn,
      summary:
        "Незавершённых ситуаций больше нет. Здесь можно посмотреть результат или вернуть вопрос в работу.",
    };
  if (item.action)
    return {
      kind: "action" as const,
      updatedOn,
      summary:
        "По этой ситуации есть поручение без результата проверки. Следующий шаг указан в решении руководителя.",
    };
  if (hasManagerUpdate)
    return {
      kind: "updated" as const,
      updatedOn,
      summary:
        "Руководитель уточнил ситуацию. Следующий шаг ещё нужно оформить в поручение с ответственным и сроком.",
    };
  if (item.priority === "check_now") {
    const access = item.findings.some(
      (f) =>
        f.category === "access" &&
        f.observations.some(
          (o) =>
            o.kind === "reported" &&
            o.citations.some((c) =>
              data.records.some(
                (r) =>
                  r.id === c.recordId &&
                  r.kind === "adaptation" &&
                  r.status === "open",
              ),
            ),
        ),
    );
    return {
      kind: "current" as const,
      updatedOn,
      summary: access
        ? "Сотрудник продолжает работать, а вопрос с доступом остаётся в открытой заявке. Поэтому его проверяем раньше разборов прошлых уходов."
        : "Сотрудник продолжает работать, а вопрос по организации смен ещё открыт. Поэтому его проверяем раньше разборов прошлых уходов.",
    };
  }
  return {
    kind: "review" as const,
    updatedOn,
    summary:
      item.priority === "review"
        ? "В записях есть обстоятельства, которые стоит уточнить. Более приоритетных незавершённых ситуаций с доступом или сменами сейчас нет."
        : "Есть незавершённый вопрос, но данных для содержательного вывода недостаточно. Начните с проверки исходных записей.",
  };
}
