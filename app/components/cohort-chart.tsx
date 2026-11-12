"use client";
import { useState } from "react";
import { HelpCircle, ChevronRight } from "lucide-react";
import type { CaseView, Dataset } from "../../lib/contracts";
import { groupEmployees } from "../../lib/overview";
import { calculateMetrics } from "../../lib/metrics";
import { formatDate } from "../../lib/format";
export default function CohortChart({
  dataset,
  cases,
  onOpen,
  onHelp,
}: {
  dataset: Dataset;
  cases: CaseView[];
  onOpen: (id: string) => void;
  onHelp: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const groups = groupEmployees(dataset);
  const metrics = calculateMetrics(dataset);
  const current = groups.find((g) => g.id === selected);
  return (
    <section className="cohort-section" aria-labelledby="cohort-title">
      <div className="section-header">
        <div>
          <h2 id="cohort-title">Как проходят первые три месяца</h2>
          <p className="section-intro">
            Ранние уходы и завершённая подработка показаны отдельно.
          </p>
        </div>
        <button className="text-button" onClick={onHelp}>
          <HelpCircle size={16} />
          Как считаем
        </button>
      </div>
      <div className="cohort-card">
        <div className="cohort-top">
          <p>
            <strong>{metrics.total}</strong> сотрудников в обзоре
          </p>
          <span className="ai-origin">Расчёт по датам</span>
        </div>
        <div
          className="cohort-waffle"
          role="img"
          aria-label={groups
            .map((g) => `${g.label}: ${g.employees.length}`)
            .join(". ")}
        >
          {groups.flatMap((g) =>
            g.employees.map((e) => (
              <span
                key={e.id}
                className={"cohort-cell cohort-" + g.id}
                aria-hidden="true"
                title={e.fullName}
              />
            )),
          )}
        </div>
        <p className="waffle-caption">
          Одна ячейка — один сотрудник. Выберите группу, чтобы посмотреть людей.
        </p>
        <div className="cohort-legend">
          {groups.map((g) => (
            <button
              key={g.id}
              aria-expanded={selected === g.id}
              aria-controls="cohort-people"
              onClick={() => setSelected(selected === g.id ? null : g.id)}
              className={selected === g.id ? "selected" : ""}
            >
              <span className={"legend-dot cohort-" + g.id} />
              <span>{g.label}</span>
              <strong>{g.employees.length}</strong>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
        <p className="cohort-takeaway">
          <strong>
            Ранний уход — у {metrics.earlyPermanent} из{" "}
            {metrics.maturePermanent} постоянных сотрудников с полным периодом
            наблюдения.
          </strong>{" "}
          Ещё {metrics.confirmedPlanned} завершили подработку в согласованный
          срок.
        </p>
        <div id="cohort-people">
          {current && (
            <div className="cohort-people">
              <h3>{current.label}</h3>
              {current.employees.map((e) => (
                <div className="cohort-person" key={e.id}>
                  <div>
                    <strong>{e.fullName ?? e.id}</strong>
                    <small>
                      {e.role} · с {formatDate(e.startedOn)}
                      {e.endedOn ? ` до ${formatDate(e.endedOn)}` : ""}
                    </small>
                  </div>
                  {cases.some((c) => c.employeeId === e.id) && (
                    <button
                      className="text-button"
                      onClick={() => onOpen(e.id)}
                    >
                      Разбор
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
