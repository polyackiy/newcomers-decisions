import { it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reserveRequest } from "../lib/ai/quota";
it("enforces durable budget even across fresh calls and concurrent reservations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "newcomers-quota-"));
  try {
    const outcomes = await Promise.allSettled(
      Array.from({ length: 8 }, () => reserveRequest(dir, 2)),
    );
    const accepted = outcomes.filter((x) => x.status === "fulfilled");
    expect(accepted.length).toBeLessThanOrEqual(2);
    while (true) {
      try {
        await reserveRequest(dir, 2);
      } catch {
        break;
      }
    }
    await expect(reserveRequest(dir, 2)).rejects.toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
