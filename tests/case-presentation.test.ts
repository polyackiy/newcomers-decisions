import { expect, it } from "vitest";
import { presentCase } from "../lib/case-presentation";
import {
  makeInterpretation,
  originalInterpretation,
} from "../lib/interpretations";
import { acceptAction, completeAction, reopenAction } from "../lib/actions";
import { buildCaseViews, explainPriority } from "../lib/evidence";
import { parseDataset } from "../lib/dataset";
import raw from "../data/demo.json";
import saved from "../data/demo-analysis.json";
const data = parseDataset(raw);
const item = buildCaseViews(data, saved.analysis, []).find(
  (c) => c.employeeId === "N-026",
)!;
const original = originalInterpretation(item, true);
const edit = makeInterpretation(
  item.employeeId,
  "Смена согласована",
  "Проверить упаковку",
  original,
);
it("shows the manager's current summary and next step instead of old AI uncertainty", () => {
  expect(presentCase(item, edit, true)).toMatchObject({
    source: "manager",
    summary: "Смена согласована",
    nextStep: "Проверить упаковку",
  });
  expect(explainPriority(data, item, true).kind).toBe("updated");
});
it("shows the accepted task rather than a later unaccepted suggestion", () => {
  const action = acceptAction(
    {
      datasetFingerprint: "demo",
      employeeId: item.employeeId,
      sourceRecordIds: [],
      title: "Проверить маркировку",
      owner: "Сергей",
      dueOn: data.asOf,
    },
    [],
    "now",
  )[0];
  expect(presentCase({ ...item, action }, edit, true).nextStep).toBe(
    "Проверить маркировку",
  );
  expect(explainPriority(data, { ...item, action }, true).kind).toBe("action");
  const completed = completeAction(
    action.id,
    "Заказ проверен",
    [action],
    "later",
  )[0];
  expect(presentCase({ ...item, action: completed }, edit, true)).toMatchObject(
    { summary: "Заказ проверен", nextStep: null, source: "manager" },
  );
  const reopened = reopenAction(
    action.id,
    "Проверить второй заказ",
    [completed],
    "later",
  )[0];
  expect(presentCase({ ...item, action: reopened }, edit, true).nextStep).toBe(
    "Проверить второй заказ",
  );
});
it("keeps unreviewed AI and manual analyses distinguishable", () => {
  expect(presentCase(item, undefined, true).source).toBe("ai");
  expect(presentCase(item, undefined, false).source).toBe("manual");
});
it("keeps original questions and citations when subsequent analysis changes", () => {
  expect(edit.original.findings).toEqual(item.findings);
  const next = makeInterpretation(
    item.employeeId,
    "Уточнение",
    "Проверить",
    { ...original, findings: [] },
    edit,
  );
  expect(next.original.findings).toEqual(item.findings);
});
