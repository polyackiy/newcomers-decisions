import { z } from "zod";
import raw from "../../../../data/demo.json";
import { ActionSchema } from "../../../../lib/contracts";
import { parseDataset, datasetFingerprint } from "../../../../lib/dataset";
import {
  buildBitrixTask,
  createBitrixTask,
  parseWebhook,
  type BitrixReceipt,
} from "../../../../lib/bitrix";
export const runtime = "nodejs";
const requests = new Map<string, Promise<BitrixReceipt>>();
const inputSchema = z
  .object({ action: ActionSchema, responsibleId: z.number().int().positive() })
  .strict();
function config() {
  const webhook = process.env.BITRIX24_WEBHOOK_URL;
  if (!webhook) return null;
  try {
    return { webhook, portal: parseWebhook(webhook).origin };
  } catch {
    return null;
  }
}
export async function GET() {
  const c = config();
  return Response.json(
    { configured: !!c, portal: c?.portal ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
const error = (message: string, status: number) =>
  Response.json({ error: message }, { status });
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== (process.env.APP_ORIGIN || new URL(request.url).origin))
    return error("Запрос с другого сайта отклонён.", 403);
  const c = config();
  if (!c)
    return error(
      "Битрикс24 не подключён. Доступен только предварительный просмотр задачи.",
      503,
    );
  let input: z.infer<typeof inputSchema>;
  try {
    const reader = request.body?.getReader();
    if (!reader) return error("Нет поручения.", 400);
    let length = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 32768) {
        await reader.cancel();
        return error("Слишком длинное поручение.", 413);
      }
      chunks.push(value);
    }
    input = inputSchema.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
  } catch {
    return error("Проверьте поручение и числовой ID ответственного.", 400);
  }
  const dataset = parseDataset(raw);
  const employee = dataset.employees.find(
    (e) => e.id === input.action.employeeId,
  );
  if (
    !employee ||
    input.action.datasetFingerprint !== (await datasetFingerprint(dataset)) ||
    input.action.status !== "open" ||
    input.action.sourceRecordIds.some(
      (id) =>
        !dataset.records.some(
          (r) => r.id === id && r.employeeId === employee.id,
        ),
    )
  )
    return error(
      "Поручение не относится к открытой ситуации этого примера.",
      400,
    );
  const key = c.portal + ":" + input.action.id;
  if (!requests.has(key)) {
    if (requests.size >= 100)
      return error("Лимит демонстрационной сессии исчерпан.", 429);
    requests.set(
      key,
      createBitrixTask(
        c.webhook,
        buildBitrixTask(
          input.action,
          employee.fullName ?? employee.id,
          input.responsibleId,
        ),
      ),
    );
  }
  try {
    return Response.json(await requests.get(key));
  } catch {
    // Keep an uncertain request in the session cache: retrying blindly can create duplicates.
    return error(
      "Создание не подтверждено. Проверьте задачи в Битрикс24, права вебхука и ID получателя. Повторная отправка этого поручения заблокирована до перезапуска сервера, чтобы не создать дубликат.",
      502,
    );
  }
}
