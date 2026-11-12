import { describe, it, expect } from "vitest";
import { parseDataset } from "../lib/dataset";
import { calculateMetrics } from "../lib/metrics";
import demo from "../data/demo.json";
import { dataset } from "./fixtures";
describe("90-day cohorts", () => {
  it("separates temporary completion, early exits and immature hires", () => {
    expect(calculateMetrics(parseDataset(demo))).toMatchObject({
      total: 30,
      mature: 24,
      recent: 6,
      maturePermanent: 20,
      earlyPermanent: 2,
      confirmedPlanned: 4,
      earlyPermanentRate: 0.1,
    });
  });
  it.each([
    ["2026-09-28", 1],
    ["2026-09-29", 0],
  ])("89/90 day boundary %s", (end, expected) => {
    const d: any = dataset();
    Object.assign(d.employees[0], {
      endedOn: end,
      exitOutcome: "early_departure",
      exitRecordId: "exit",
    });
    d.records.push({
      ...d.records[0],
      id: "exit",
      kind: "exit",
      createdOn: end,
      updatedOn: end,
    });
    expect(calculateMetrics(parseDataset(d)).earlyPermanent).toBe(expected);
  });
  it("does not include recent leavers in either side of the cohort rate", () => {
    const d: any = dataset();
    d.employees[0].startedOn = "2026-11-01";
    d.employees[0].endedOn = "2026-11-10";
    d.employees[0].exitRecordId = "exit";
    d.employees[0].exitOutcome = "unknown";
    d.records[0].createdOn = d.records[0].updatedOn = "2026-11-01";
    d.records.push({
      ...d.records[0],
      id: "exit",
      kind: "exit",
      createdOn: "2026-11-10",
      updatedOn: "2026-11-10",
    });
    expect(calculateMetrics(parseDataset(d))).toMatchObject({
      mature: 0,
      recent: 1,
      earlyPermanent: 0,
      earlyPermanentRate: null,
    });
  });
  it("empty denominator is unknown, not zero percent", () => {
    expect(
      calculateMetrics(
        parseDataset({ ...dataset(), employees: [], records: [] }),
      ).earlyPermanentRate,
    ).toBeNull();
  });
});
