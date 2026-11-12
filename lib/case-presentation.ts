import type { CaseView } from "./contracts";
import { originalInterpretation, type Interpretation } from "./interpretations";

export function presentCase(
  item: CaseView,
  edit: Interpretation | undefined,
  ai: boolean,
) {
  const action = item.action;
  if (action && action.status !== "open") {
    return {
      source: "manager" as const,
      label:
        action.status === "done"
          ? "Результат руководителя"
          : "Решение руководителя",
      title:
        action.status === "done" ? "Результат проверки" : "Поручение отменено",
      summary: action.outcome ?? "Результат не указан.",
      nextStep: null,
      nextStepLabel: "",
      hypothesis: false,
    };
  }
  if (action || edit) {
    const followUp = action?.history?.at(-1);
    return {
      source: "manager" as const,
      label: edit ? "Уточнено руководителем" : "Решение руководителя",
      title: action
        ? "Проверить результат поручения"
        : "Согласовать следующий шаг",
      summary: edit?.summary ?? action!.title,
      nextStep:
        followUp?.kind === "reopened"
          ? followUp.reason
          : action
            ? edit
              ? action.title
              : null
            : edit!.suggestedAction,
      nextStepLabel: action
        ? "Следующая проверка по поручению"
        : "Предложенный следующий шаг",
      hypothesis: false,
    };
  }
  return {
    source: ai ? ("ai" as const) : ("manual" as const),
    label: ai ? "Вывод AI" : "Разбор записей",
    title: item.title.replace("доступ к WMS", "доступ к складской системе"),
    summary: originalInterpretation(item, ai).summary,
    nextStep: null,
    nextStepLabel: "",
    hypothesis: item.findings.some((f) =>
      f.observations.some((o) => o.kind === "hypothesis"),
    ),
  };
}
