import type { CaseView, Dataset } from "../../lib/contracts";
import {
  originalInterpretation,
  type Interpretation,
} from "../../lib/interpretations";
import { formatDate } from "../../lib/format";

export default function AnalysisHistory({
  item,
  edit,
  ai,
  dataset,
}: {
  item: CaseView;
  edit?: Interpretation;
  ai: boolean;
  dataset: Dataset;
}) {
  const original = edit?.original ?? originalInterpretation(item, ai);
  const findings = original.findings ?? item.findings;
  const unknowns = findings.flatMap((f) => f.unknowns);
  return (
    <details className="analysis-history">
      <summary>
        История:{" "}
        {original.origin === "ai" ? "исходный разбор AI" : "исходный разбор"}
      </summary>
      <div className="analysis-history-body">
        <p className="field-help">
          {edit || item.action
            ? "Это исходная версия для сравнения. Актуальное решение руководителя показано выше; вопросы из этой версии могут быть уже прояснены."
            : "Здесь сохранены полный разбор, его основания и вопросы для проверки."}
        </p>
        {edit && item.action && item.action.status !== "open" && (
          <section>
            <h3>Сохранённое уточнение руководителя</h3>
            <p className="preserve-lines">{edit.summary}</p>
          </section>
        )}
        <h3>Исходный вывод</h3>
        <p className="preserve-lines">{original.summary}</p>
        <h3>Первоначально предложенный шаг</h3>
        <p className="preserve-lines">{original.suggestedAction}</p>
        {!original.findings && edit && (
          <p className="field-help">
            Ниже — цитаты и вопросы из доступного разбора исходных записей. Они
            не заменяют сохранённое уточнение.
          </p>
        )}
        {unknowns.length > 0 && (
          <section className="history-questions">
            <h3>Вопросы на момент разбора</h3>
            <ul>
              {unknowns.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </section>
        )}
        {findings.length > 0 && (
          <details className="history-citations">
            <summary>Наблюдения и подтверждающие цитаты</summary>
            {findings.flatMap((f, fi) =>
              f.observations.map((o, oi) => (
                <div className="observation" key={`${fi}-${oi}`}>
                  <p>
                    {o.kind === "hypothesis" && (
                      <span className="badge neutral">Гипотеза</span>
                    )}
                    {o.text}
                  </p>
                  {o.citations.map((c, i) => {
                    const record = dataset.records.find(
                      (r) => r.id === c.recordId,
                    );
                    return (
                      <blockquote key={i}>
                        <p>«{c.quote}»</p>
                        <cite>
                          {record
                            ? `${record.author ?? "Запись о сотруднике"} · ${formatDate(record.updatedOn)}`
                            : "Исходная запись"}
                        </cite>
                      </blockquote>
                    );
                  })}
                </div>
              )),
            )}
          </details>
        )}
      </div>
    </details>
  );
}
