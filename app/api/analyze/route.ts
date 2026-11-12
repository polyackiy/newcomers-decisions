import { reserveRequest } from "../../../lib/ai/quota";
import { parseDataset, MAX_BYTES } from "../../../lib/dataset";
import { analyzeDataset } from "../../../lib/ai/server";
export const runtime = "nodejs";
export const maxDuration = 60;
// Single VPS: durable global budget plus in-flight guard; reverse proxy limits per-client traffic.
const state = { active: false, used: 0 };
const error = (message: string, status: number) =>
  Response.json({ error: { code: String(status), message } }, { status });
export async function POST(request: Request) {
  if (process.env.AI_ENABLED !== "true" || !process.env.OPENAI_API_KEY)
    return error(
      "Живой AI пока не подключён. Исходные записи и решения доступны.",
      503,
    );
  const origin = request.headers.get("origin");
  const allowedOrigin = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (origin && origin !== allowedOrigin)
    return error("Запрос с другого сайта отклонён.", 403);
  if (state.active)
    return error("Разбор уже выполняется. Дождитесь результата.", 429);
  if (state.used >= 10)
    return error(
      "Лимит этой демонстрационной сессии исчерпан. Данные и решения доступны.",
      429,
    );
  const reader = request.body?.getReader();
  if (!reader) return error("Нет данных для разбора.", 400);
  let input: unknown;
  try {
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES + 100) {
        await reader.cancel();
        return error("Файл больше 256 КиБ.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    input = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return error("Не удалось прочитать JSON.", 400);
  }
  let dataset;
  try {
    dataset = parseDataset((input as { dataset?: unknown })?.dataset);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Некорректные данные.", 400);
  }
  // Recheck after asynchronous body reading so concurrent requests cannot race the guard.
  if (state.active || state.used >= 10)
    return error("Лимит запросов. Повторите позже.", 429);
  try {
    await reserveRequest(
      process.env.AI_STATE_DIR || ".runtime",
      Number(process.env.AI_TOTAL_REQUESTS || 20),
    );
  } catch {
    return error(
      "Лимит AI-запросов или временная блокировка. Основной сценарий доступен.",
      429,
    );
  }
  state.active = true;
  state.used++;
  try {
    return Response.json(
      await analyzeDataset(dataset, {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || "gpt-6.1-terra",
      }),
    );
  } catch {
    return error(
      "Не удалось получить проверенный AI-разбор. Предыдущий разбор и ваши действия сохранены. Попробуйте позже.",
      502,
    );
  } finally {
    state.active = false;
  }
}
