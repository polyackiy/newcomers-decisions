import { describe, it, expect, vi, afterEach } from "vitest";
import {
  acceptAction,
  completeAction,
  dismissAction,
  loadActions,
  saveActions,
} from "../lib/actions";
const now = "2026-11-12T12:00:00Z";
const draft = {
  datasetFingerprint: "demo",
  employeeId: "N-028",
  sourceRecordIds: ["access"],
  title: "Проверить доступ",
  owner: "Руководитель склада",
  dueOn: "2026-11-13",
};
afterEach(() => vi.unstubAllGlobals());
describe("manager decisions", () => {
  it.each(["owner", "title", "dueOn"])("requires %s", (field) =>
    expect(() => acceptAction({ ...draft, [field]: "" }, [], now)).toThrow(),
  );
  it("deduplicates an open decision", () => {
    const a = acceptAction(draft, [], now);
    expect(acceptAction(draft, a, now)).toHaveLength(1);
  });
  it("requires an observed result", () => {
    const a = acceptAction(draft, [], now);
    expect(() => completeAction(a[0].id, " ", a, now)).toThrow();
    expect(
      completeAction(a[0].id, "Доступ подтверждён", a, now)[0].status,
    ).toBe("done");
    expect(a[0].status).toBe("open");
  });
  it("dismissal requires a reason", () => {
    const a = acceptAction(draft, [], now);
    expect(() => dismissAction(a[0].id, "", a, now)).toThrow();
    expect(dismissAction(a[0].id, "Заявка дублируется", a, now)[0].status).toBe(
      "dismissed",
    );
  });
  it("isolates datasets in storage and preserves human text", () => {
    const map = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => map.set(k, v),
    });
    const a = acceptAction({ ...draft, title: "Моя формулировка" }, [], now);
    saveActions("demo", a);
    expect(loadActions("other").actions).toEqual([]);
    expect(loadActions("demo").actions[0].title).toBe("Моя формулировка");
  });
  it("survives denied/corrupt storage without reporting persistence", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
    });
    expect(loadActions("demo").available).toBe(false);
    expect(saveActions("demo", []).persisted).toBe(false);
  });
});

describe("revising completed decisions", () => {
  it("corrects a result without changing its status or losing the previous version", async () => {
    const { correctOutcome } = await import("../lib/actions");
    const open = acceptAction(draft, [], now);
    const done = completeAction(open[0].id, "First result", open, now);
    const changed = correctOutcome(
      done[0].id,
      "Corrected result",
      done,
      "2026-11-12T13:00:00Z",
    );
    expect(changed[0]).toMatchObject({
      status: "done",
      outcome: "Corrected result",
      history: [
        {
          status: "done",
          outcome: "First result",
          reason: "Исправление записи",
        },
      ],
    });
    expect(done[0].outcome).toBe("First result");
    expect(() => correctOutcome(done[0].id, " ", done, now)).toThrow();
    expect(() => correctOutcome(open[0].id, "Text", open, now)).toThrow();
  });
  it.each(["done", "dismissed"])(
    "reopens %s and preserves history through re-completion and storage",
    async (status) => {
      const { reopenAction, correctOutcome } = await import("../lib/actions");
      const open = acceptAction(draft, [], now);
      const closed = (status === "done" ? completeAction : dismissAction)(
        open[0].id,
        "Previous outcome",
        open,
        now,
      );
      const revised = correctOutcome(
        closed[0].id,
        "Updated outcome",
        closed,
        now,
      );
      const reopened = reopenAction(open[0].id, "Check again", revised, now);
      expect(reopened[0]).toMatchObject({
        status: "open",
        outcome: null,
        title: draft.title,
        owner: draft.owner,
      });
      expect(reopened[0].history).toHaveLength(2);
      expect(reopened[0].history?.[1]).toMatchObject({
        status,
        outcome: "Updated outcome",
        reason: "Check again",
      });
      expect(() => reopenAction(open[0].id, " ", closed, now)).toThrow();
      expect(() => reopenAction(open[0].id, "Again", reopened, now)).toThrow();
      const final = completeAction(open[0].id, "Verified again", reopened, now);
      expect(final[0].history).toEqual(reopened[0].history);
      const map = new Map();
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => map.set(k, v),
      });
      saveActions("demo", final);
      expect(loadActions("demo").actions).toEqual(final);
    },
  );
});
