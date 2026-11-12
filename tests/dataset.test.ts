import { describe, it, expect } from "vitest";
import { parseDataset, datasetFingerprint } from "../lib/dataset";
import { dataset } from "./fixtures";
describe("dataset validation", () => {
  it("accepts documented shape", () =>
    expect(parseDataset(dataset()).employees).toHaveLength(1));
  it.each([
    "duplicate",
    "missing link",
    "wrong owner",
    "impossible date",
    "end before start",
    "future record",
    "oversize text",
  ])("rejects %s", (kind) => {
    const d: any = dataset();
    if (kind === "duplicate") d.employees.push(d.employees[0]);
    if (kind === "missing link") d.employees[0].hireRecordId = "missing";
    if (kind === "wrong owner") d.records[0].employeeId = "ghost";
    if (kind === "impossible date") d.employees[0].startedOn = "2026-02-30";
    if (kind === "end before start") d.employees[0].endedOn = "2025-01-01";
    if (kind === "future record") d.records[0].updatedOn = "2027-01-01";
    if (kind === "oversize text") d.records[0].text = "a".repeat(1001);
    expect(() => parseDataset(d)).toThrow();
  });
  it("fingerprints canonical keys and changes on content/asOf", async () => {
    const d = parseDataset(dataset());
    expect(await datasetFingerprint(d)).toBe(
      await datasetFingerprint(
        Object.fromEntries(Object.entries(d).reverse()) as typeof d,
      ),
    );
    expect(await datasetFingerprint(d)).not.toBe(
      await datasetFingerprint({ ...d, asOf: "2026-11-13" }),
    );
  });
});
