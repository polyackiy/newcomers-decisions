import { describe, it, expect } from "vitest";
import { buildCaseViews, validateEvidence } from "../lib/evidence";
import { parseDataset } from "../lib/dataset";
import demo from "../data/demo.json";
import manual from "../data/demo-manual.json";
import { clone, dataset } from "./fixtures";
describe("evidence and priorities", () => {
  it("puts the open access issue first", () => {
    const cases = buildCaseViews(parseDataset(demo), manual, []);
    expect(cases[0]).toMatchObject({
      employeeId: "N-028",
      priority: "check_now",
    });
  });
  it("does not elevate a closed issue", () => {
    const d = clone(demo);
    d.records
      .filter((r) => r.employeeId === "N-028")
      .forEach((r) => (r.status = "closed"));
    expect(
      buildCaseViews(parseDataset(d), manual, []).find(
        (c) => c.employeeId === "N-028",
      )?.priority,
    ).not.toBe("check_now");
  });
  it("does not invent conclusions without analysis or mix datasets", () => {
    const cases = buildCaseViews(parseDataset(dataset()), null, []);
    expect(cases.every((c) => c.findings.length === 0)).toBe(true);
    expect(cases.some((c) => c.employeeId === "N-028")).toBe(false);
  });
  it.each(["record", "quote", "owner", "empty"])(
    "rejects fabricated evidence %s",
    (kind) => {
      const a = clone(manual);
      const c = a.findings[0].observations[0].citations[0];
      if (kind === "record") c.recordId = "ghost";
      if (kind === "quote") c.quote = "Этой цитаты нет";
      if (kind === "owner") a.findings[0].employeeId = "N-001";
      if (kind === "empty") c.quote = " ";
      expect(() => validateEvidence(parseDataset(demo), a)).toThrow();
    },
  );
  it("accepts exact quotes", () =>
    expect(
      validateEvidence(parseDataset(demo), manual).findings.length,
    ).toBeGreaterThan(0));
});
it("does not invent WMS for other kinds of access", () => {
  const d: any = dataset();
  d.records.push({
    id: "mail",
    employeeId: "N-001",
    kind: "adaptation",
    createdOn: "2026-11-12",
    updatedOn: "2026-11-12",
    status: "open",
    text: "Нет доступа к почте.",
  });
  const a = {
    findings: [
      {
        employeeId: "N-001",
        category: "access",
        observations: [
          {
            text: "Нет доступа к почте.",
            kind: "reported",
            citations: [{ recordId: "mail", quote: "Нет доступа к почте." }],
          },
        ],
        unknowns: [],
        suggestedAction: "Проверить почту.",
      },
    ],
  };
  expect(buildCaseViews(parseDataset(d), a, [])[0].title).not.toContain("WMS");
});
it("keeps a saved human decision visible when AI no longer mentions the employee", () => {
  const d = parseDataset(dataset());
  const action: any = {
    id: "a",
    datasetFingerprint: "x",
    employeeId: "N-001",
    sourceRecordIds: ["hire-N-001"],
    title: "Проверить условия выхода",
    owner: "HR",
    dueOn: "2026-11-13",
    status: "open",
    outcome: null,
    createdAt: "2026-11-12",
    updatedAt: "2026-11-12",
  };
  const result = buildCaseViews(d, { findings: [] }, [action]);
  expect(result).toHaveLength(1);
  expect(result[0].action?.title).toBe(action.title);
});
