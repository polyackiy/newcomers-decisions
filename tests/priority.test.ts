import { expect, it } from "vitest";
import {
  buildCaseViews,
  selectPrimaryCase,
  explainPriority,
} from "../lib/evidence";
import { parseDataset } from "../lib/dataset";
import { acceptAction, completeAction, reopenAction } from "../lib/actions";
import raw from "../data/demo.json";
import saved from "../data/demo-analysis.json";
const data = parseDataset(raw);
it("explains the actual current priority and moves reopened cases back into the queue", () => {
  let cases = buildCaseViews(data, saved.analysis, []);
  const primary = selectPrimaryCase(cases)!;
  expect(primary.employeeId).toBe("N-028");
  expect(explainPriority(data, primary)).toMatchObject({
    kind: "current",
    updatedOn: "2026-11-12",
  });
  let actions = acceptAction(
    {
      datasetFingerprint: "test",
      employeeId: primary.employeeId,
      sourceRecordIds: primary.sourceRecordIds,
      title: "Check",
      owner: "Manager",
      dueOn: "2026-11-13",
    },
    [],
    "2026-11-12T12:00:00Z",
  );
  actions = completeAction(
    actions[0].id,
    "Done",
    actions,
    "2026-11-12T13:00:00Z",
  );
  cases = buildCaseViews(data, saved.analysis, actions);
  expect(selectPrimaryCase(cases)?.employeeId).toBe("N-026");
  actions = reopenAction(
    actions[0].id,
    "Check again",
    actions,
    "2026-11-12T14:00:00Z",
  );
  expect(
    selectPrimaryCase(buildCaseViews(data, saved.analysis, actions))
      ?.employeeId,
  ).toBe("N-028");
});
it("prefers unfinished reviews over completed high-priority cases and explains completed fallback", () => {
  const cases = buildCaseViews(data, saved.analysis, []);
  const closed = cases.map((c) => ({
    ...c,
    action: { status: "done" },
  })) as typeof cases;
  const review = cases.find((c) => c.employeeId === "N-017")!;
  expect(selectPrimaryCase([...closed, review])).toBe(review);
  expect(explainPriority(data, closed[0]).kind).toBe("completed");
  expect(selectPrimaryCase([])).toBeUndefined();
});
