import { expect, it } from "vitest";
import { groupEmployees, overviewCounts } from "../lib/overview";
import { parseDataset } from "../lib/dataset";
import { buildCaseViews } from "../lib/evidence";
import { acceptAction, completeAction, reopenAction } from "../lib/actions";
import raw from "../data/demo.json";
import analysis from "../data/demo-manual.json";
it("partitions all employees without treating planned endings as early loss", () => {
  const d = parseDataset(raw);
  const groups = groupEmployees(d);
  expect(groups.map((g) => [g.id, g.employees.length])).toEqual([
    ["retained", 18],
    ["early", 2],
    ["planned", 4],
    ["recent", 6],
  ]);
  expect(
    new Set(groups.flatMap((g) => g.employees.map((e) => e.id))).size,
  ).toBe(30);
  d.employees[0].employmentIntent = "unknown";
  d.employees[0].endedOn = d.employees[0].startedOn;
  expect(
    groupEmployees(d).find((g) => g.id === "other")?.employees.length,
  ).toBe(1);
});
it("counts actual decisions and due work without counting resolved work", () => {
  const d = parseDataset(raw);
  const draft = {
    datasetFingerprint: "demo",
    employeeId: "N-028",
    sourceRecordIds: [],
    title: "Проверить",
    owner: "Сергей",
    dueOn: d.asOf,
  };
  let actions = acceptAction(draft, [], "now");
  expect(overviewCounts(buildCaseViews(d, analysis, actions), d.asOf)).toEqual({
    needsReview: 3,
    inProgress: 1,
    due: 1,
  });
  actions = completeAction(actions[0].id, "Проверено", actions, "later");
  expect(overviewCounts(buildCaseViews(d, analysis, actions), d.asOf).due).toBe(
    0,
  );
  actions = reopenAction(actions[0].id, "Повторить", actions, "later");
  expect(overviewCounts(buildCaseViews(d, analysis, actions), d.asOf).due).toBe(
    1,
  );
});
