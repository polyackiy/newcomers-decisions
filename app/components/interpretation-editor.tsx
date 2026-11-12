"use client";
import { useRef, useState } from "react";
import CaseSummary from "./case-summary";
import { PencilLine } from "lucide-react";
import type { CaseView } from "../../lib/contracts";
import {
  originalInterpretation,
  type Interpretation,
} from "../../lib/interpretations";
export default function InterpretationEditor({
  item,
  edit,
  ai,
  initiallyEditing = false,
  onSave,
}: {
  item: CaseView;
  edit?: Interpretation;
  ai: boolean;
  initiallyEditing?: boolean;
  onSave: (summary: string, suggestedAction: string) => void;
}) {
  const original = originalInterpretation(item, ai);
  const [editing, setEditing] = useState(initiallyEditing);
  const [summary, setSummary] = useState(edit?.summary ?? original.summary);
  const [action, setAction] = useState(
    edit?.suggestedAction ?? original.suggestedAction,
  );
  const [error, setError] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  function finish() {
    setEditing(false);
    requestAnimationFrame(() => button.current?.focus());
  }
  return (
    <section className="interpretation">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            try {
              onSave(summary, action);
              finish();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Не удалось сохранить правку.",
              );
            }
          }}
        >
          <label htmlFor="interpretation-summary">Вывод руководителя</label>
          <textarea
            id="interpretation-summary"
            rows={5}
            maxLength={4000}
            required
            autoFocus
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <label htmlFor="interpretation-action">
            Предложенный следующий шаг
          </label>
          <textarea
            id="interpretation-action"
            rows={4}
            maxLength={800}
            required
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          <p className="field-help">
            Правка сохранится отдельно от исходных записей. Уже принятое
            поручение от этого не изменится.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="revision-buttons">
            <button className="button primary" type="submit">
              Сохранить уточнение
            </button>
            <button className="button secondary" type="button" onClick={finish}>
              Отмена
            </button>
          </div>
        </form>
      ) : (
        <>
          <CaseSummary item={item} edit={edit} ai={ai} />
          {(!item.action || item.action.status === "open") && (
            <button
              ref={button}
              className="text-button"
              onClick={() => {
                setSummary(edit?.summary ?? original.summary);
                setAction(edit?.suggestedAction ?? original.suggestedAction);
                setError("");
                setEditing(true);
              }}
            >
              <PencilLine size={16} />
              Уточнить вывод и следующий шаг
            </button>
          )}
        </>
      )}
    </section>
  );
}
