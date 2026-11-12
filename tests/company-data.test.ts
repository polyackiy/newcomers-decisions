import { expect, it } from "vitest";
import raw from "../data/demo.json";
import manual from "../data/demo-manual.json";
import { parseDataset } from "../lib/dataset";
import { validateEvidence } from "../lib/evidence";
it("keeps the fictional company roster, chronology and evidence coherent", () => {
  const data = parseDataset(raw);
  expect(data.employees.every((e) => e.fullName && e.mentor && e.manager)).toBe(
    true,
  );
  expect(new Set(data.employees.map((e) => e.fullName)).size).toBe(
    data.employees.length,
  );
  expect(new Set(data.employees.map((e) => e.startedOn)).size).toBeGreaterThan(
    8,
  );
  for (const r of data.records) {
    const e = data.employees.find((e) => e.id === r.employeeId)!;
    expect(r.author && r.title).toBeTruthy();
    expect(r.createdOn >= e.startedOn).toBe(true);
    if (e.endedOn) expect(r.updatedOn <= e.endedOn).toBe(true);
  }
  for (const e of data.employees.filter(
    (e) => e.exitOutcome === "planned_completion",
  )) {
    expect(e.employmentIntent).toBe("temporary");
    expect(e.endedOn).toBe(e.plannedEndOn);
  }
  expect(validateEvidence(data, manual).findings.length).toBeGreaterThanOrEqual(
    4,
  );
});

it("keeps cited hiring records available in the case and its future plan", async () => {
  const { buildCaseViews } = await import("../lib/evidence");
  const { datasetFingerprint } = await import("../lib/dataset");
  const { default: saved } = await import("../data/demo-analysis.json");
  const data = parseDataset(raw);
  expect(saved.datasetFingerprint).toBe(await datasetFingerprint(data));
  const analysis = validateEvidence(data, saved.analysis);
  for (const item of buildCaseViews(data, analysis, [])) {
    for (const finding of item.findings) {
      for (const observation of finding.observations) {
        for (const citation of observation.citations) {
          expect(item.sourceRecordIds).toContain(citation.recordId);
        }
      }
    }
  }
});
