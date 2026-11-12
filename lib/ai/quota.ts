import { mkdir, readFile, writeFile, rename, rmdir } from "node:fs/promises";
import { join } from "node:path";
/** Durable total-call budget for one VPS with a shared local filesystem. Fail closed on errors. */
export async function reserveRequest(
  directory: string,
  limit = 20,
): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Некорректная квота.");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lock = join(directory, "quota.lock");
  try {
    await mkdir(lock);
  } catch {
    throw new Error("Разбор уже запускается. Повторите позже.");
  }
  try {
    let used = 0;
    try {
      const data = JSON.parse(
        await readFile(join(directory, "quota.json"), "utf8"),
      );
      if (!Number.isInteger(data.used) || data.used < 0)
        throw new Error("Invalid quota");
      used = data.used;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (used >= limit)
      throw new Error("Лимит демонстрационных AI-запросов исчерпан.");
    await writeFile(
      join(directory, "quota.pending"),
      JSON.stringify({ used: used + 1 }),
      { mode: 0o600 },
    );
    await rename(
      join(directory, "quota.pending"),
      join(directory, "quota.json"),
    );
    return used + 1;
  } finally {
    await rmdir(lock);
  }
}
