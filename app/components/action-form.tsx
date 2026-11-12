"use client";
import { useRef, useState } from "react";
import { ArrowRight, Check, Copy, CalendarDays, UserRound } from "lucide-react";
import DecisionHistory from "./decision-history";
import { formatDate } from "../../lib/format";
import BitrixTask from "./bitrix-task";
import type { Interpretation } from "../../lib/interpretations";
import { buildPlanText } from "../../lib/decision-text";
import type { ActionDraft, CaseView, Dataset } from "../../lib/contracts";
export default function ActionForm({
  item,
  dataset,
  fingerprint,
  onAccept,
  onResolve,
  onRevise,
  storageAvailable = true,
  interpretation,
  ai = false,
}: {
  interpretation?: Interpretation;
  ai?: boolean;
  item: CaseView;
  dataset: Dataset;
  fingerprint: string;
  storageAvailable?: boolean;
  onAccept: (d: ActionDraft) => void;
  onResolve: (id: string, outcome: string, dismiss: boolean) => void;
  onRevise: (id: string, text: string, kind: "correction" | "reopened") => void;
}) {
  const action = item.action;
  const [revision, setRevision] = useState<"correction" | "reopened" | null>(
    null,
  );
  const [revisionText, setRevisionText] = useState("");
  const correctionButton = useRef<HTMLButtonElement | null>(null);
  const reopenButton = useRef<HTMLButtonElement | null>(null);
  const stateHeading = useRef<HTMLHeadingElement | null>(null);
  const employee = dataset.employees.find((e) => e.id === item.employeeId);
  const [copyMessage, setCopyMessage] = useState("");
  const [showCopyText, setShowCopyText] = useState(false);
  const [title, setTitle] = useState(
    interpretation?.suggestedAction ??
      item.findings.find((f) => f.suggestedAction)?.suggestedAction ??
      "Проверить контекст исходных записей и уточнить следующий шаг.",
  );
  const [owner, setOwner] = useState(
    employee?.manager ?? "Руководитель подразделения",
  );
  const [dueOn, setDueOn] = useState(
    new Date(Date.parse(dataset.asOf + "T00:00:00Z") + 86400000)
      .toISOString()
      .slice(0, 10),
  );
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState("");
  const [dismiss, setDismiss] = useState(false);
  const run = (fn: () => void) => {
    setError("");
    try {
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить.");
    }
  };
  const planText = action ? buildPlanText(employee, action) : "";
  async function copyPlan() {
    try {
      await navigator.clipboard.writeText(planText);
      setCopyMessage("Текст скопирован. Его можно вставить в рабочую задачу.");
      setShowCopyText(false);
    } catch {
      setShowCopyText(true);
      setCopyMessage(
        "Браузер не разрешил копирование. Выделите и скопируйте текст ниже.",
      );
    }
  }
  if (action?.status === "done" || action?.status === "dismissed")
    return (
      <section className="result-card">
        <p className="case-status">
          {action.status === "done" ? "Разбор завершён" : "Поручение отменено"}
        </p>
        <h3 ref={stateHeading} tabIndex={-1}>
          Что планировали проверить
        </h3>
        <p>{action.title}</p>
        <div className="result-meta">
          <span>
            <UserRound size={16} />
            {action.owner}
          </span>
          <span>
            <CalendarDays size={16} />
            до {formatDate(action.dueOn)}
          </span>
        </div>
        <h3>
          {action.status === "done"
            ? "Какой результат записан"
            : "Почему поручение отменили"}
        </h3>
        <p className="result-text">{action.outcome}</p>
        {revision ? (
          <form
            className="revision-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => {
                onRevise(action.id, revisionText, revision);
                setRevision(null);
                setOutcome("");
                setDismiss(false);
                requestAnimationFrame(() => stateHeading.current?.focus());
              });
            }}
          >
            <h3>
              {revision === "correction"
                ? "Исправить запись"
                : "Вернуть ситуацию в работу"}
            </h3>
            <p className="field-help">
              {revision === "correction"
                ? "Предыдущая версия останется в истории. Статус ситуации не изменится."
                : "Укажите, что ещё нужно проверить. Поручение снова станет незавершённым, а предыдущий результат останется в истории."}
            </p>
            <label htmlFor="revision-text">
              {revision === "correction"
                ? action.status === "dismissed"
                  ? "Исправленная причина отмены"
                  : "Исправленный результат"
                : "Что ещё нужно проверить?"}
            </label>
            <textarea
              id="revision-text"
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              rows={5}
              required
              maxLength={1200}
              autoFocus
            />
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="revision-buttons">
              <button className="button primary" type="submit">
                {revision === "correction"
                  ? "Сохранить исправление"
                  : "Вернуть в работу"}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setRevision(null);
                  setError("");
                  requestAnimationFrame(() =>
                    (revision === "correction"
                      ? correctionButton
                      : reopenButton
                    ).current?.focus(),
                  );
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        ) : (
          <div className="result-actions">
            <button
              className="button secondary"
              ref={correctionButton}
              onClick={() => {
                setRevision("correction");
                setRevisionText(action.outcome ?? "");
                setError("");
              }}
            >
              {action.status === "done"
                ? "Исправить результат"
                : "Исправить причину"}
            </button>
            <button
              className="text-button"
              ref={reopenButton}
              onClick={() => {
                setRevision("reopened");
                setRevisionText("");
                setError("");
              }}
            >
              Вернуть в работу
            </button>
          </div>
        )}
        <BitrixTask action={action} employee={employee} />
        <DecisionHistory action={action} />
        <p className="local-note">
          Результат записан вами. Приложение не проверяет выполнение операций в
          складской системе.
        </p>
        {!storageAvailable && (
          <p className="notice">
            Изменения доступны только до закрытия страницы.
          </p>
        )}
      </section>
    );
  if (action)
    return (
      <section>
        <div className="accepted-banner">
          <Check size={20} />
          <div>
            <h3 ref={stateHeading} tabIndex={-1}>
              {action.history?.at(-1)?.kind === "reopened"
                ? "Снова в работе"
                : "План сохранён"}
            </h3>
            <p>
              {action.owner} · до {formatDate(action.dueOn)}
            </p>
          </div>
        </div>
        {action.history?.at(-1)?.kind === "reopened" && (
          <div className="reopen-reason">
            <strong>Что ещё нужно проверить</strong>
            <p>{action.history.at(-1)?.reason}</p>
          </div>
        )}
        <p className="decision-title">{action.title}</p>
        <BitrixTask action={action} employee={employee} />
        <button
          className="button secondary full copy-button"
          onClick={copyPlan}
        >
          <Copy size={17} />
          Скопировать поручение
        </button>
        <p className="copy-feedback" role="status">
          {copyMessage}
        </p>
        {showCopyText && (
          <>
            <label htmlFor="copy-plan">Текст для копирования</label>
            <textarea
              id="copy-plan"
              value={planText}
              readOnly
              rows={8}
              onFocus={(e) => e.target.select()}
            />
          </>
        )}
        <h3 className="outcome-heading">После выполнения поручения</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => {
              onResolve(action.id, outcome, dismiss);
              requestAnimationFrame(() => stateHeading.current?.focus());
            });
          }}
        >
          <label htmlFor="outcome">
            {dismiss
              ? "Почему поручение больше не требуется?"
              : "Что проверили и что изменилось?"}
          </label>
          <p className="field-help">
            {dismiss
              ? "Объясните, почему решили не выполнять поручение. Так сохранится история решения."
              : "Опишите то, что удалось подтвердить. Если вопрос не решён, можно продолжить работу и записать результат позже."}
          </p>
          <textarea
            id="outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder={
              dismiss
                ? "Опишите причину отмены"
                : employee?.endedOn
                  ? "Что удалось выяснить и что решили изменить в процессе?"
                  : "Что сотрудник выполнил самостоятельно и кто это проверил?"
            }
            rows={4}
            required
            maxLength={1200}
          />
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="button primary full" type="submit">
            {dismiss ? "Сохранить причину" : "Зафиксировать результат"}
            <Check size={18} />
          </button>
          <button
            className="text-button full"
            type="button"
            onClick={() => {
              setDismiss(!dismiss);
              setError("");
            }}
          >
            {dismiss ? "Вернуться к результату" : "Отменить поручение"}
          </button>
        </form>
        <DecisionHistory action={action} />
        <p className="local-note">
          {storageAvailable
            ? "Сохраняется в этом браузере."
            : "Изменения доступны только до закрытия страницы."}{" "}
          Сохранение результата не меняет статус задачи в Битрикс24.
        </p>
      </section>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          onAccept({
            datasetFingerprint: fingerprint,
            employeeId: item.employeeId,
            sourceRecordIds: item.sourceRecordIds,
            title,
            owner,
            dueOn,
          }),
        );
      }}
    >
      <div className="form-intro">
        <h3>Подготовьте поручение</h3>
        <span className={"ai-origin" + (interpretation ? " human" : "")}>
          {interpretation
            ? "Предложение уточнено руководителем"
            : ai
              ? "Предложение AI"
              : "Предложение по записям"}
        </span>
        <p className="muted">
          Ниже — предложение по этим записям. Уточните его, выберите
          ответственного и срок проверки.
        </p>
      </div>
      <label htmlFor="action-title">Что сделать</label>
      <textarea
        id="action-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        rows={5}
        required
        maxLength={800}
      />
      <div className="form-row">
        <div>
          <label htmlFor="owner">Ответственный</label>
          <input
            id="owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            list="owners"
            required
            maxLength={100}
          />
          <datalist id="owners">
            <option value={employee?.manager} />
            <option value={employee?.mentor} />
            <option value="Павел Елисеев · оператор WMS" />
            <option value="Екатерина Смирнова · менеджер по персоналу" />
          </datalist>
        </div>
        <div>
          <label htmlFor="due">Срок</label>
          <input
            id="due"
            type="date"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
            required
          />
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full" type="submit">
        Сохранить план
        <ArrowRight size={18} />
      </button>
      <p className="local-note">
        {storageAvailable
          ? "Сохраняется в этом браузере."
          : "Изменения доступны только до закрытия страницы."}{" "}
        После сохранения можно создать задачу в Битрикс24 или скопировать
        поручение.
      </p>
    </form>
  );
}
