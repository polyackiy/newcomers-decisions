"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  HelpCircle,
  LoaderCircle,
  RefreshCw,
  PencilLine,
  CalendarDays,
} from "lucide-react";
import type {
  Dataset,
  Analysis,
  AnalysisEnvelope,
  Action,
  ActionDraft,
  CaseView,
} from "../../lib/contracts";
import { EnvelopeSchema } from "../../lib/contracts";
import {
  buildCaseViews,
  validateEvidence,
  shouldApplyAnalysis,
  selectPrimaryCase,
  explainPriority,
} from "../../lib/evidence";
import { calculateMetrics, daysBetween } from "../../lib/metrics";
import {
  acceptAction,
  completeAction,
  dismissAction,
  correctOutcome,
  reopenAction,
  loadActions,
  saveActions,
} from "../../lib/actions";
import CaseSummary from "./case-summary";
import { presentCase } from "../../lib/case-presentation";
import CohortChart from "./cohort-chart";
import { overviewCounts } from "../../lib/overview";
import {
  makeInterpretation,
  originalInterpretation,
  loadInterpretations,
  saveInterpretations,
  type Interpretation,
} from "../../lib/interpretations";
import CaseDetail from "./case-detail";
import HelpPanel, { type HelpTopic } from "./help-panel";
import { formatDate } from "../../lib/format";

type Props = {
  initialDataset: Dataset;
  initialFingerprint: string;
  initialEnvelope: AnalysisEnvelope | null;
  manualAnalysis: Analysis;
  aiEnabled: boolean;
};
function status(item: CaseView) {
  return item.action?.status === "done"
    ? "Результат записан"
    : item.action?.status === "dismissed"
      ? "Разбор завершён"
      : item.action
        ? "Есть план действий"
        : "Нужно разобраться";
}
export default function NewcomersApp({
  initialDataset: dataset,
  initialFingerprint: fingerprint,
  initialEnvelope,
  manualAnalysis,
  aiEnabled,
}: Props) {
  const [envelope, setEnvelope] = useState(initialEnvelope);
  const [interpretations, setInterpretations] = useState<Interpretation[]>([]);
  const [editingOnOpen, setEditingOnOpen] = useState(false);
  const [actions, setActions] = useState<Action[]>([]);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [help, setHelp] = useState<HelpTopic | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const abort = useRef<AbortController | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const roster = useRef<HTMLDetailsElement>(null);
  const analysis =
    envelope && shouldApplyAnalysis(fingerprint, envelope)
      ? envelope.analysis
      : manualAnalysis;
  const metrics = useMemo(() => calculateMetrics(dataset), [dataset]);
  const cases = useMemo(
    () =>
      buildCaseViews(
        dataset,
        analysis,
        actions,
        interpretations.map((e) => e.employeeId),
      ),
    [dataset, analysis, actions, interpretations],
  );
  const primary = selectPrimaryCase(cases);
  const counts = overviewCounts(cases, dataset.asOf);
  const planned = cases
    .filter((c) => c.action?.status === "open")
    .sort((a, b) => a.action!.dueOn.localeCompare(b.action!.dueOn));
  const primaryEdit = interpretations.find(
    (e) => e.employeeId === primary?.employeeId,
  );
  const priorityReason = primary
    ? explainPriority(dataset, primary, !!primaryEdit)
    : null;
  const primaryView = primary
    ? presentCase(primary, primaryEdit, !!envelope)
    : null;
  const active = selected ? cases.find((c) => c.employeeId === selected) : null;
  const remaining = cases.filter((c) => c.employeeId !== primary?.employeeId);
  const filtered = remaining.filter(
    (c) =>
      filter === "all" ||
      (filter === "done"
        ? c.action && c.action.status !== "open"
        : !c.action || c.action.status === "open"),
  );
  const employee = dataset.employees.find((e) => e.id === primary?.employeeId);
  useEffect(() => {
    const stored = loadActions(fingerprint);
    const savedEdits = loadInterpretations(fingerprint);
    setInterpretations(savedEdits.edits);
    setActions(stored.actions);
    setStorageAvailable(stored.available && savedEdits.available);
    setReady(true);
  }, [fingerprint]);
  useEffect(() => () => abort.current?.abort(), []);
  function openCase(id: string, edit = false) {
    setEditingOnOpen(edit);
    opener.current = document.activeElement as HTMLElement;
    setSelected(id);
  }
  function closeCase() {
    setSelected(null);
    requestAnimationFrame(() => opener.current?.focus());
  }
  function persist(next: Action[]) {
    setActions(next);
    const saved = saveActions(fingerprint, next);
    setStorageAvailable(saved.persisted);
    setMessage(
      saved.persisted
        ? "Изменения сохранены в этом браузере."
        : "Изменения доступны только до закрытия страницы: браузер запретил сохранение.",
    );
  }
  function accept(draft: ActionDraft) {
    persist(acceptAction(draft, actions, new Date().toISOString()));
  }
  function resolve(id: string, outcome: string, dismiss: boolean) {
    persist(
      (dismiss ? dismissAction : completeAction)(
        id,
        outcome,
        actions,
        new Date().toISOString(),
      ),
    );
  }
  function revise(id: string, text: string, kind: "correction" | "reopened") {
    persist(
      (kind === "correction" ? correctOutcome : reopenAction)(
        id,
        text,
        actions,
        new Date().toISOString(),
      ),
    );
  }
  function saveInterpretation(
    id: string,
    summary: string,
    suggestedAction: string,
  ) {
    const item = cases.find((c) => c.employeeId === id)!;
    const next = makeInterpretation(
      id,
      summary,
      suggestedAction,
      originalInterpretation(item, !!envelope),
      interpretations.find((e) => e.employeeId === id),
    );
    const values = [
      ...interpretations.filter((e) => e.employeeId !== id),
      next,
    ];
    setInterpretations(values);
    const saved = saveInterpretations(fingerprint, values);
    setStorageAvailable(saved.persisted);
    setMessage(
      saved.persisted
        ? "Уточнение сохранено. Исходный текст остаётся доступен."
        : "Уточнение доступно только до закрытия страницы: браузер запретил сохранение.",
    );
  }
  async function analyze() {
    if (busy) return;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset }),
        signal: controller.signal,
      });
      const json = await r.json();
      if (!r.ok)
        throw new Error(
          json.error?.message ??
            "Не удалось обновить разбор. Предыдущие выводы доступны.",
        );
      const next = EnvelopeSchema.parse(json);
      if (!shouldApplyAnalysis(fingerprint, next))
        throw new Error("Ответ относится к другому набору записей.");
      validateEvidence(dataset, next.analysis);
      setEnvelope(next);
      setMessage(
        "Разбор записей обновлён. Ваши уточнения, планы и результаты сохранены.",
      );
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(
          e instanceof Error
            ? e.message
            : "Не удалось обновить разбор. Попробуйте позже.",
        );
    } finally {
      setBusy(false);
    }
  }
  function showRoster() {
    if (roster.current) {
      roster.current.open = true;
      roster.current.scrollIntoView({ behavior: "smooth", block: "start" });
      roster.current.querySelector("summary")?.focus({ preventScroll: true });
    }
  }
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" aria-label="Адаптация — обзор">
            <span className="product-wordmark">
              адаптация<span>.</span>
            </span>
            <span className="workspace-label">Обзор команды</span>
          </a>
          <nav aria-label="Разделы обзора">
            <button className="text-button roster-link" onClick={showRoster}>
              Сотрудники
            </button>
            <button className="text-button" onClick={() => setHelp("about")}>
              <HelpCircle size={18} />
              Справка
            </button>
          </nav>
        </div>
      </header>
      <main className="container">
        <div className="page-heading">
          <div>
            <h1>Адаптация новичков</h1>
            <p className="subtitle">
              Что мешает самостоятельной работе и какие поручения пора
              проверить.
            </p>
          </div>
          <div className="snapshot">
            <span>
              По записям на {formatDate(dataset.asOf)}{" "}
              {dataset.asOf.slice(0, 4)}
            </span>
            <small>Учебный пример · все имена и ситуации вымышлены</small>
          </div>
        </div>
        {!storageAvailable && (
          <p className="notice" role="status">
            Браузер запретил сохранение. Планы и результаты будут доступны
            только до закрытия страницы.
          </p>
        )}
        <section className="overview-stats" aria-label="Работа руководителя">
          <div>
            <strong>{counts.needsReview}</strong>
            <span>Нужен разбор</span>
            <small>Ситуации без принятого решения</small>
          </div>
          <div>
            <strong>{counts.inProgress}</strong>
            <span>Поручения в работе</span>
            <small>Ожидают проверки результата</small>
          </div>
          <div className="due-stat">
            <strong>{counts.due}</strong>
            <span>Проверить к {formatDate(dataset.asOf)}</span>
            <small>Срок наступил или уже прошёл</small>
          </div>
        </section>
        <section className="operations-grid" aria-label="Ситуация и поручения">
          <div>
            <div className="section-header">
              <h2>
                {primary?.action && primary.action.status !== "open"
                  ? "Завершённые разборы"
                  : "Начните с этой ситуации"}
              </h2>
              <span className="muted small">{employee?.department}</span>
            </div>
            {primary && employee ? (
              <article className="hero-card">
                <div className="hero-card-top">
                  <span
                    className={
                      "case-status" +
                      (primary.action && primary.action.status !== "open"
                        ? " completed"
                        : "")
                    }
                  >
                    {status(primary)}
                  </span>
                  <span className="muted small">
                    {employee.endedOn
                      ? `Уход ${formatDate(employee.endedOn)}`
                      : `${daysBetween(employee.startedOn, dataset.asOf) + 1}-й день работы`}
                  </span>
                </div>
                <p className="person-name">
                  {employee.fullName ?? employee.id}
                  <span>
                    {employee.role} · наставник {employee.mentor ?? "не указан"}
                  </span>
                </p>
                <h2>{primaryView?.title}</h2>
                <CaseSummary
                  item={primary}
                  edit={primaryEdit}
                  ai={!!envelope}
                  compact
                />
                {(!primary.action || primary.action.status === "open") && (
                  <button
                    className="text-button edit-summary-button"
                    disabled={!ready}
                    onClick={() => openCase(primary.employeeId, true)}
                  >
                    <PencilLine size={16} />
                    Уточнить вывод и следующий шаг
                  </button>
                )}
                <div className="hero-footer">
                  <button
                    className="button primary"
                    onClick={() => openCase(primary.employeeId)}
                    disabled={!ready}
                  >
                    {primary.action
                      ? "Открыть план и результат"
                      : "Посмотреть записи и решение"}
                    <ArrowRight size={18} />
                  </button>
                </div>
                {priorityReason && (
                  <div className="priority-note">
                    <strong>
                      {primaryView?.source === "manager"
                        ? "Что требует внимания сейчас"
                        : "Почему эта ситуация первая"}
                    </strong>
                    <p>{priorityReason.summary}</p>
                    <details className="priority-details">
                      <summary>Подробнее о порядке разбора</summary>
                      <p>
                        Сначала показываем незавершённые ситуации. При
                        одинаковом приоритете выше стоят более свежие записи.
                        {priorityReason.updatedOn
                          ? ` Последняя запись здесь — ${formatDate(priorityReason.updatedOn)}.`
                          : ""}{" "}
                        Исходные записи доступны отдельно и могут описывать
                        более раннее состояние.
                      </p>
                    </details>
                  </div>
                )}
              </article>
            ) : (
              <div className="empty-state">
                <h2>Нет ситуаций для разбора</h2>
                <p>В доступных записях не выделены вопросы для проверки.</p>
              </div>
            )}
          </div>
          <aside className="today-panel">
            <div className="section-header">
              <h2>Поручения руководителя</h2>
              <CalendarDays size={18} />
            </div>
            <div className="today-list">
              {planned.length ? (
                planned.map((c) => {
                  const a = c.action!;
                  const current = presentCase(
                    c,
                    interpretations.find(
                      (edit) => edit.employeeId === c.employeeId,
                    ),
                    !!envelope,
                  );
                  const e = dataset.employees.find(
                    (e) => e.id === c.employeeId,
                  )!;
                  return (
                    <button
                      className="today-task"
                      key={a.id}
                      onClick={() => openCase(c.employeeId)}
                      disabled={!ready}
                    >
                      <span className="today-task-top">
                        <strong>{e.fullName ?? e.id}</strong>
                        <span
                          className={
                            a.dueOn <= dataset.asOf ? "task-due" : "muted"
                          }
                        >
                          {a.dueOn === dataset.asOf
                            ? "Сегодня"
                            : `До ${formatDate(a.dueOn)}`}
                        </span>
                      </span>
                      <span>{current.nextStep ?? current.summary}</span>
                      <small>{a.owner}</small>
                      <span className="row-status state-open">
                        В работе <ChevronRight size={14} />
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="today-empty">
                  <h3>Поручений пока нет</h3>
                  <p>
                    Откройте ситуацию, проверьте записи и сохраните план. Здесь
                    появятся ответственный и срок проверки.
                  </p>
                </div>
              )}
            </div>
            <p className="panel-note">
              На дату обзора — {formatDate(dataset.asOf)} Сроки и статусы берём
              из ваших поручений.
            </p>
          </aside>
        </section>
        <CohortChart
          dataset={dataset}
          cases={cases}
          onOpen={openCase}
          onHelp={() => setHelp("metrics")}
        />
        <section className="cases-section" aria-labelledby="cases-title">
          <div className="section-header">
            <h2 id="cases-title">Другие ситуации</h2>
            <div className="filters" aria-label="Статус разбора">
              {[
                ["all", "Все"],
                ["open", "В работе"],
                ["done", "Завершены"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={filter === value ? "active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="case-list">
            <div className="case-columns" aria-hidden="true">
              <span>Сотрудник</span>
              <span>Что проверить</span>
              <span>Статус</span>
              <span />
            </div>
            {filtered.map((c) => {
              const e = dataset.employees.find((e) => e.id === c.employeeId)!;
              return (
                <button
                  className="case-row"
                  key={c.employeeId}
                  onClick={() => openCase(c.employeeId)}
                  disabled={!ready}
                >
                  <span className="row-person">
                    <strong>{e.fullName ?? e.id}</strong>
                    <small>
                      {e.role} · {e.department}
                    </small>
                  </span>
                  <span className="row-situation">
                    <strong>
                      {
                        presentCase(
                          c,
                          interpretations.find(
                            (e) => e.employeeId === c.employeeId,
                          ),
                          !!envelope,
                        ).title
                      }
                    </strong>
                    <small>
                      {e.endedOn
                        ? `Ушёл ${formatDate(e.endedOn)} · нужен разбор процесса`
                        : `Работает с ${formatDate(e.startedOn)}`}
                    </small>
                  </span>
                  <span
                    className={
                      "row-status state-" + (c.action?.status ?? "new")
                    }
                  >
                    {status(c)}
                  </span>
                  <ChevronRight size={18} />
                </button>
              );
            })}
            {!filtered.length && (
              <p className="empty-filter">
                В этой группе пока нет других ситуаций.
              </p>
            )}
          </div>
        </section>
        <details className="roster" ref={roster}>
          <summary>
            <span>
              Сотрудники в обзоре
              <small>Приём, адаптация и завершение работы</small>
            </span>
            <span>{metrics.total}</span>
          </summary>
          <div className="roster-body">
            <p className="section-intro">
              В обзоре есть и обычная адаптация без открытых вопросов. Откройте
              сотрудника, чтобы прочитать записи наставника и менеджера по
              персоналу.
            </p>
            {dataset.employees.map((e) => (
              <details className="roster-person" key={e.id}>
                <summary>
                  <span>
                    <strong>{e.fullName ?? e.id}</strong>
                    <small>
                      {e.role} · {e.department}
                    </small>
                  </span>
                  <span>
                    {e.endedOn
                      ? e.exitOutcome === "planned_completion"
                        ? "Подработка завершена"
                        : "Ушёл"
                      : "Работает"}
                  </span>
                </summary>
                <div className="roster-records">
                  <p>
                    Выход: {formatDate(e.startedOn)} · Руководитель:{" "}
                    {e.manager ?? "не указан"}. Наставник:{" "}
                    {e.mentor ?? "не указан"}.
                  </p>
                  {dataset.records
                    .filter((r) => r.employeeId === e.id)
                    .map((r) => (
                      <article key={r.id}>
                        <strong>{r.title ?? "Запись о сотруднике"}</strong>
                        <small>
                          {formatDate(r.updatedOn)} · {r.author}
                        </small>
                        <p>{r.text}</p>
                      </article>
                    ))}
                </div>
              </details>
            ))}
          </div>
        </details>
        <section className="analysis-footer" aria-label="О разборе">
          <div>
            <strong>
              Разбор {dataset.records.length} записей по {metrics.total}{" "}
              сотрудникам
            </strong>
            <p>
              {envelope
                ? "Выводы подготовлены AI. В каждой ситуации доступны исходные записи для проверки."
                : "Сейчас открыт подготовленный вручную разбор. Исходные записи доступны в каждой ситуации."}
            </p>
            <button className="text-button" onClick={() => setHelp("ai")}>
              Что делает AI и где его ограничения
            </button>
          </div>
          <button
            className="button secondary"
            onClick={analyze}
            disabled={!aiEnabled || busy || !ready}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <RefreshCw size={17} />
            )}{" "}
            {busy ? "Читаем записи…" : "Обновить разбор"}
          </button>
        </section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="feedback" role="status">
          {message}
        </p>
        <footer className="footer">
          <span>Адаптация · демонстрационный рабочий пример</span>
          <button className="text-button" onClick={() => setHelp("storage")}>
            Где сохраняются решения
          </button>
        </footer>
      </main>
      {active && (
        <CaseDetail
          key={active.employeeId}
          item={active}
          dataset={dataset}
          fingerprint={fingerprint}
          onClose={closeCase}
          onAccept={accept}
          onResolve={resolve}
          onRevise={revise}
          storageAvailable={storageAvailable}
          interpretation={interpretations.find(
            (e) => e.employeeId === active.employeeId,
          )}
          ai={!!envelope}
          initiallyEditing={editingOnOpen}
          onInterpretation={(summary, action) =>
            saveInterpretation(active.employeeId, summary, action)
          }
        />
      )}
      {help && (
        <HelpPanel
          topic={help}
          dataset={dataset}
          metrics={metrics}
          envelope={envelope}
          onClose={() => setHelp(null)}
          onReset={() => {
            persist([]);
            setInterpretations([]);
            if (!saveInterpretations(fingerprint, []).persisted)
              setStorageAvailable(false);
            setHelp(null);
            setFilter("all");
          }}
        />
      )}
    </>
  );
}
