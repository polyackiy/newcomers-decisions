"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FileText, ClipboardCheck } from "lucide-react";
import type { ActionDraft, CaseView, Dataset } from "../../lib/contracts";
import { daysBetween } from "../../lib/metrics";
import InterpretationEditor from "./interpretation-editor";
import type { Interpretation } from "../../lib/interpretations";
import ActionForm from "./action-form";
import AnalysisHistory from "./analysis-history";
import { formatDate } from "../../lib/format";
import { presentCase } from "../../lib/case-presentation";
export default function CaseDetail({
  item,
  dataset,
  fingerprint,
  onClose,
  onAccept,
  onResolve,
  onRevise,
  storageAvailable,
  interpretation,
  ai,
  initiallyEditing,
  onInterpretation,
}: {
  interpretation?: Interpretation;
  ai: boolean;
  initiallyEditing?: boolean;
  onInterpretation: (summary: string, suggestedAction: string) => void;
  item: CaseView;
  dataset: Dataset;
  fingerprint: string;
  onClose: () => void;
  storageAvailable: boolean;
  onAccept: (d: ActionDraft) => void;
  onResolve: (id: string, outcome: string, dismiss: boolean) => void;
  onRevise: (id: string, text: string, kind: "correction" | "reopened") => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(
    initiallyEditing ? "evidence" : item.action ? "action" : "evidence",
  );
  const e = dataset.employees.find((e) => e.id === item.employeeId)!;
  const refs = dataset.records.filter((r) =>
    item.sourceRecordIds.includes(r.id),
  );
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d?.close();
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="case-dialog"
      aria-labelledby="case-heading"
      onCancel={(ev) => {
        ev.preventDefault();
        onClose();
      }}
      onClick={(ev) => {
        if (ev.target === dialog.current) onClose();
      }}
    >
      <div className="dialog-inner">
        <header className="dialog-header">
          <button className="text-button" onClick={onClose}>
            <ArrowLeft size={18} />К обзору
          </button>
          <span className="muted small">{e.department}</span>
        </header>
        <div className="dialog-content">
          {!storageAvailable && (
            <p className="notice" role="status">
              Изменения доступны только до закрытия страницы: браузер не
              разрешил сохранение.
            </p>
          )}
          <div className="case-heading">
            <p className="eyebrow">
              {e.endedOn
                ? "РАЗБОР УХОДА"
                : `${daysBetween(e.startedOn, dataset.asOf) + 1}-Й ДЕНЬ РАБОТЫ`}
            </p>
            <p className="person-name">{e.fullName ?? e.id}</p>
            <h2 id="case-heading">
              {presentCase(item, interpretation, ai).title}
            </h2>
            <p className="muted">
              {e.role} · выход {formatDate(e.startedOn)}
              {e.endedOn ? ` · уход ${formatDate(e.endedOn)}` : ""}
            </p>
          </div>
          <nav className="steps" aria-label="Шаги разбора">
            <button
              className={step === "evidence" ? "active" : ""}
              onClick={() => setStep("evidence")}
            >
              Решение и записи
            </button>
            <button
              className={step === "action" ? "active" : ""}
              onClick={() => setStep("action")}
            >
              План и результат
            </button>
          </nav>
          {step === "evidence" ? (
            <>
              <div className="section-label">
                <FileText size={18} />
                <h3>
                  {interpretation || item.action
                    ? "Актуальное решение"
                    : "Разбор ситуации"}
                </h3>
              </div>
              <InterpretationEditor
                item={item}
                edit={interpretation}
                ai={ai}
                initiallyEditing={initiallyEditing}
                onSave={onInterpretation}
              />
              <AnalysisHistory
                item={item}
                edit={interpretation}
                ai={ai}
                dataset={dataset}
              />
              <details className="source-list">
                <summary>
                  Открыть исходные записи <span>{refs.length}</span>
                </summary>
                {refs.map((r) => (
                  <article className="source" key={r.id}>
                    <div>
                      <strong>
                        {r.title ??
                          (r.kind === "exit"
                            ? "Беседа при увольнении"
                            : "Запись об адаптации")}
                      </strong>
                      <span
                        className={
                          "badge " +
                          (r.status === "open" ? "attention" : "neutral")
                        }
                      >
                        {r.status === "open" ? "Открыта" : "Закрыта"}
                      </span>
                    </div>
                    <p>{r.text}</p>
                    <small>
                      {r.author} · {formatDate(r.updatedOn)}
                    </small>
                  </article>
                ))}
              </details>
              {!item.action && !interpretation && (
                <div className="business-note">
                  <ClipboardCheck size={21} />
                  <p>
                    {!e.endedOn
                      ? "После устранения препятствия важно проверить самостоятельное выполнение рабочей операции."
                      : "Уточните обстоятельства ухода, прежде чем менять процесс найма или адаптации."}
                  </p>
                </div>
              )}
              <button
                className="button primary full"
                onClick={() => {
                  setStep("action");
                  dialog.current
                    ?.querySelector(".dialog-content")
                    ?.scrollTo(0, 0);
                }}
              >
                {item.action
                  ? "Открыть план и результат"
                  : "Подготовить поручение"}
                <ArrowRight size={18} />
              </button>
            </>
          ) : (
            <ActionForm
              item={item}
              interpretation={interpretation}
              ai={ai}
              dataset={dataset}
              fingerprint={fingerprint}
              onAccept={onAccept}
              onResolve={onResolve}
              onRevise={onRevise}
              storageAvailable={storageAvailable}
            />
          )}
        </div>
      </div>
    </dialog>
  );
}
