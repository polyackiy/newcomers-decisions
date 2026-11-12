import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NewcomersApp from "../app/components/newcomers-app";
import ActionForm from "../app/components/action-form";
import { parseDataset } from "../lib/dataset";
import { AnalysisSchema } from "../lib/contracts";
import demo from "../data/demo.json";
import manual from "../data/demo-manual.json";
it("labels a hypothesis on the opening card, before opening sources", () => {
  const data = parseDataset(demo);
  const a = AnalysisSchema.parse(manual);
  // Isolate the case under test: other current cases may legitimately outrank a hypothesis.
  a.findings = a.findings.filter((f) => f.employeeId === "N-028");
  a.findings[0].observations[0].kind = "hypothesis";
  const html = renderToStaticMarkup(
    createElement(NewcomersApp, {
      initialDataset: data,
      initialFingerprint: "demo",
      initialEnvelope: null,
      manualAnalysis: a,
      aiEnabled: false,
    }),
  );
  expect(html).toContain("Гипотеза");
});
it("does not promise persistent saving when storage is blocked", () => {
  const html = renderToStaticMarkup(
    createElement(ActionForm, {
      item: {
        employeeId: "N-028",
        title: "Проверить доступ",
        priority: "review",
        sourceRecordIds: [],
        findings: [],
        action: null,
      },
      dataset: parseDataset(demo),
      fingerprint: "demo",
      onAccept: () => {},
      onResolve: () => {},
      storageAvailable: false,
    } as any),
  );
  expect(html).toContain("до закрытия страницы");
  expect(html).not.toContain("Сохраняется в этом браузере.");
});
