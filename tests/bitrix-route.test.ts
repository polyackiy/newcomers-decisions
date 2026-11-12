import { afterEach, expect, it, vi } from "vitest";
import { GET, POST } from "../app/api/bitrix/tasks/route";
import { acceptAction } from "../lib/actions";
import { parseDataset, datasetFingerprint } from "../lib/dataset";
import raw from "../data/demo.json";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const req = (body: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/bitrix/tasks", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
it("does not simulate a remote creation when no webhook is configured", async () => {
  vi.stubEnv("BITRIX24_WEBHOOK_URL", "");
  expect(await (await GET()).json()).toMatchObject({ configured: false });
  expect((await POST(req({}))).status).toBe(503);
});
it("rejects foreign origins and malformed tasks; deduplicates confirmed creations", async () => {
  vi.stubEnv(
    "BITRIX24_WEBHOOK_URL",
    "https://example.bitrix24.ru/rest/1/secret/",
  );
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  expect((await POST(req({}, "https://foreign.test"))).status).toBe(403);
  expect((await POST(req({}))).status).toBe(400);
  const d = parseDataset(raw);
  const a = acceptAction(
    {
      datasetFingerprint: await datasetFingerprint(d),
      employeeId: "N-028",
      title: "Проверить",
      owner: "Сергей",
      dueOn: "2026-11-13",
      sourceRecordIds: [],
    },
    [],
    "now",
  )[0];
  let calls = 0;
  vi.stubGlobal("fetch", async () => {
    calls++;
    return Response.json({ result: { task: { id: 321 } } });
  });
  const responses = await Promise.all([
    POST(req({ action: a, responsibleId: 42 })),
    POST(req({ action: a, responsibleId: 42 })),
  ]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(await responses[0].json()).toMatchObject({ taskId: 321 });
  expect(calls).toBe(1);
  const config = await (await GET()).text();
  expect(config).not.toContain("secret");
});
