import { afterEach, expect, it, vi } from "vitest";
import {
  makeInterpretation,
  loadInterpretations,
  saveInterpretations,
} from "../lib/interpretations";
import { buildCaseViews } from "../lib/evidence";
import { parseDataset } from "../lib/dataset";
import raw from "../data/demo.json";
const original = {
  summary: "Заявка открыта",
  suggestedAction: "Уточнить доступ",
  origin: "ai" as const,
};
afterEach(() => vi.unstubAllGlobals());
it("keeps edited employees reachable when refreshed AI has no finding for them", () => {
  const data = parseDataset(raw);
  const cases = buildCaseViews(data, { findings: [] }, [], ["N-001"]);
  expect(
    cases.find((c) => c.employeeId === "N-001")?.sourceRecordIds.length,
  ).toBeGreaterThan(0);
});
it("preserves a long valid AI original while allowing a short human correction", () => {
  const source = {
    summary: "а".repeat(4100),
    suggestedAction: "б".repeat(8100),
    origin: "ai" as const,
  };
  const edit = makeInterpretation(
    "N-028",
    "Краткое уточнение",
    "Проверить заказ",
    source,
  );
  expect(edit.original).toEqual(source);
});
it("preserves first AI text through repeated human edits and a refreshed analysis", () => {
  const first = makeInterpretation(
    "N-028",
    " Доступ выдан ",
    "Проверить заказ",
    original,
    undefined,
    "2026-11-12T10:00:00Z",
  );
  const second = makeInterpretation(
    "N-028",
    "Заказ собран",
    "Проверить ещё раз",
    { ...original, summary: "Новый ответ AI" },
    first,
    "2026-11-12T11:00:00Z",
  );
  expect(second.original).toEqual(original);
  expect(first.summary).toBe("Доступ выдан");
  expect(second.summary).toBe("Заказ собран");
  expect(() =>
    makeInterpretation("N-028", " ", "Проверить", original),
  ).toThrow();
});
it("persists per dataset and reports corrupt or blocked storage", () => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
  const edits = [makeInterpretation("N-028", "Правка", "Действие", original)];
  expect(saveInterpretations("one", edits).persisted).toBe(true);
  expect(loadInterpretations("one").edits).toEqual(edits);
  expect(loadInterpretations("two").edits).toEqual([]);
  for (const k of store.keys()) store.set(k, "{broken");
  expect(loadInterpretations("one").available).toBe(false);
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error();
    },
    setItem: () => {
      throw Error();
    },
  });
  expect(saveInterpretations("one", edits).persisted).toBe(false);
});
