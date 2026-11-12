import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import CaseSummary from "../app/components/case-summary";
import AnalysisHistory from "../app/components/analysis-history";
import {
  originalInterpretation,
  makeInterpretation,
} from "../lib/interpretations";
import { buildCaseViews } from "../lib/evidence";
import { parseDataset } from "../lib/dataset";
import raw from "../data/demo.json";
import saved from "../data/demo-analysis.json";
it("keeps superseded questions in collapsed history, outside the current manager decision", () => {
  const dataset = parseDataset(raw);
  const item = buildCaseViews(dataset, saved.analysis, []).find(
    (c) => c.employeeId === "N-026",
  )!;
  const original = originalInterpretation(item, true);
  const edit = makeInterpretation(
    item.employeeId,
    "Смена согласована",
    "Проверить упаковку",
    original,
  );
  const current = renderToStaticMarkup(
    createElement(CaseSummary, { item, edit, ai: true }),
  );
  const history = renderToStaticMarkup(
    createElement(AnalysisHistory, { item, edit, ai: true, dataset }),
  );
  expect(current).toContain("Смена согласована");
  expect(current).toContain("Проверить упаковку");
  expect(current).not.toContain(item.findings[0].unknowns[0]);
  expect(history).toMatch(/^<details[^>]*>/);
  expect(history.split(">")[0]).not.toMatch(/\bopen\b/);
  expect(history).toContain(item.findings[0].unknowns[0]);
  expect(history).toContain(
    item.findings[0].observations[0].citations[0].quote,
  );
});
