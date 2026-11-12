import type { Action } from "../../lib/contracts";
import { formatTimestamp } from "../../lib/format";

export default function DecisionHistory({ action }: { action: Action }) {
  if (!action.history?.length) return null;
  return (
    <details className="decision-history">
      <summary>
        История изменений <span>{action.history.length}</span>
      </summary>
      <ol>
        {[...action.history].reverse().map((entry, index) => (
          <li key={index}>
            <div className="history-heading">
              <strong>
                {entry.kind === "correction"
                  ? "Запись исправлена"
                  : "Возвращено в работу"}
              </strong>
              <time dateTime={entry.changedAt}>
                {formatTimestamp(entry.changedAt)}
              </time>
            </div>
            {entry.kind === "reopened" && <p>{entry.reason}</p>}
            <div className="previous-result">
              <span>
                {entry.status === "done"
                  ? "Предыдущий результат"
                  : "Предыдущая причина отмены"}{" "}
                · {formatTimestamp(entry.recordedAt)}
              </span>
              <p>{entry.outcome}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
