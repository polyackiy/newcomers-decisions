import type { CaseView } from "../../lib/contracts";
import type { Interpretation } from "../../lib/interpretations";
import { presentCase } from "../../lib/case-presentation";
import { formatTimestamp } from "../../lib/format";

export default function CaseSummary({
  item,
  edit,
  ai,
  compact = false,
}: {
  item: CaseView;
  edit?: Interpretation;
  ai: boolean;
  compact?: boolean;
}) {
  const view = presentCase(item, edit, ai);
  const timestamp =
    item.action && item.action.status !== "open"
      ? item.action.updatedAt
      : edit?.updatedAt;
  const summary =
    compact && view.source !== "manager"
      ? view.summary.split("\n\n")[0]
      : view.summary;
  return (
    <>
      <div className="interpretation-heading">
        <span
          className={"ai-origin" + (view.source === "manager" ? " human" : "")}
        >
          {view.label}
        </span>
        {timestamp && (
          <time dateTime={timestamp}>{formatTimestamp(timestamp)}</time>
        )}
      </div>
      <div className="hero-evidence">
        <p className="preserve-lines">
          {view.hypothesis && <span className="badge neutral">Гипотеза</span>}
          {summary}
        </p>
        {view.nextStep && (
          <div className="current-next-step">
            <strong>{view.nextStepLabel}</strong>
            <p className="preserve-lines">{view.nextStep}</p>
          </div>
        )}
      </div>
    </>
  );
}
