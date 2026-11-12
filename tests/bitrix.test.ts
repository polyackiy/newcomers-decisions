import { afterEach, expect, it, vi } from "vitest";
import {
  buildBitrixTask,
  createBitrixTask,
  parseWebhook,
  loadBitrixReceipt,
} from "../lib/bitrix";
afterEach(() => vi.unstubAllGlobals());
it("retains a previously confirmed link independently of current webhook configuration", () => {
  const receipt = {
    taskId: 123,
    url: "https://old.bitrix24.ru/company/personal/user/42/tasks/task/view/123/",
  };
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(receipt) });
  expect(loadBitrixReceipt("saved")).toEqual({ receipt, available: true });
  vi.stubGlobal("localStorage", { getItem: () => "{bad" });
  expect(loadBitrixReceipt("saved").available).toBe(false);
});
import { acceptAction } from "../lib/actions";
const action = acceptAction(
  {
    datasetFingerprint: "demo",
    employeeId: "N-028",
    sourceRecordIds: ["A-28"],
    title: "Проверить самостоятельный отбор",
    owner: "Сергей Громов",
    dueOn: "2026-11-13",
  },
  [],
  "now",
)[0];
it("sends the reviewed action with explicit recipient and Moscow deadline, returning only confirmed task IDs", async () => {
  const payload = buildBitrixTask(action, "Илья Назаров", 42);
  expect(payload.fields.RESPONSIBLE_ID).toBe(42);
  expect(payload.fields.DEADLINE).toBe("2026-11-13T18:00:00+03:00");
  expect(payload.fields.DESCRIPTION).toContain("Сергей Громов");
  let sent: unknown;
  const transport = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    sent = { url, body: JSON.parse(init!.body as string) };
    return Response.json({ result: { task: { id: "123" } } });
  }) as typeof fetch;
  const receipt = await createBitrixTask(
    "https://example.bitrix24.ru/rest/1/secret/",
    payload,
    transport,
  );
  expect(sent).toEqual({
    url: "https://example.bitrix24.ru/rest/1/secret/tasks.task.add.json",
    body: payload,
  });
  expect(receipt).toEqual({
    taskId: 123,
    url: "https://example.bitrix24.ru/company/personal/user/42/tasks/task/view/123/",
  });
});
it("rejects API errors, missing IDs and invalid recipient rather than inventing success", async () => {
  const payload = buildBitrixTask(action, "Илья", 42);
  for (const response of [
    { error: "ACCESS_DENIED", error_description: "secret" },
    { result: { task: { id: "wrong" } } },
    {},
  ]) {
    await expect(
      createBitrixTask(
        "https://example.bitrix24.ru/rest/1/secret/",
        payload,
        (async () => Response.json(response)) as typeof fetch,
      ),
    ).rejects.toThrow();
  }
  expect(() => buildBitrixTask(action, "Илья", 0)).toThrow();
  expect(() => parseWebhook("http://localhost/rest/1/secret/")).toThrow();
  expect(() =>
    parseWebhook(
      "https://example.bitrix24.ru/rest/1/secret/tasks.task.add.json",
    ),
  ).toThrow();
});
