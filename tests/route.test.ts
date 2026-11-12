import { it, expect, vi, afterEach } from "vitest";
import { POST } from "../app/api/analyze/route";
import demo from "../data/demo.json";
afterEach(() => vi.unstubAllEnvs());
it("disabled API leaves a clear usable response", async () => {
  vi.stubEnv("AI_ENABLED", "false");
  const r = await POST(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      body: JSON.stringify({ dataset: demo }),
    }),
  );
  expect(r.status).toBe(503);
  expect((await r.json()).error.message).toContain("Исходные записи");
});
it("rejects cross-origin calls before model access", async () => {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "fake");
  const r = await POST(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { origin: "https://wrong.example" },
      body: "{}",
    }),
  );
  expect(r.status).toBe(403);
});
it("bounds bodies without relying on Content-Length", async () => {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "fake");
  const r = await POST(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      body: "x".repeat(270000),
    }),
  );
  expect(r.status).toBe(413);
});
it("rejects invalid data before charging quota", async () => {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "fake");
  const r = await POST(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      body: '{"dataset":{}}',
    }),
  );
  expect(r.status).toBe(400);
});
it("accepts the configured public origin behind a reverse proxy", async () => {
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "fake");
  vi.stubEnv("APP_ORIGIN", "https://tz2.pubrick.pro");
  const r = await POST(
    new Request("http://0.0.0.0:3000/api/analyze", {
      method: "POST",
      headers: { origin: "https://tz2.pubrick.pro" },
      body: '{"dataset":{}}',
    }),
  );
  expect(r.status).toBe(400);
});
