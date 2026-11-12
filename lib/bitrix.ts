import { z } from "zod";
import type { Action } from "./contracts";
export const BitrixReceiptSchema = z.object({
  taskId: z.number().int().positive(),
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://")),
});
export type BitrixReceipt = z.infer<typeof BitrixReceiptSchema>;
export function loadBitrixReceipt(key: string): {
  receipt: BitrixReceipt | null;
  available: boolean;
} {
  try {
    const raw = localStorage.getItem(key);
    return {
      receipt: raw ? BitrixReceiptSchema.parse(JSON.parse(raw)) : null,
      available: true,
    };
  } catch {
    return { receipt: null, available: false };
  }
}
export function parseWebhook(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !/^\/rest\/\d+\/[a-zA-Z0-9_-]+\/$/.test(u.pathname)
  )
    throw Error("Нужен базовый HTTPS-адрес входящего вебхука.");
  return u;
}
export function buildBitrixTask(
  action: Action,
  employeeName: string,
  responsibleId: number,
) {
  z.number().int().positive().parse(responsibleId);
  return {
    fields: {
      TITLE: `Адаптация · ${employeeName}: ${action.title}`.slice(0, 250),
      DESCRIPTION: `${action.title}\n\nСотрудник: ${employeeName}\nОтветственный по плану: ${action.owner}\nСрок проверки: ${action.dueOn}\n${action.history?.at(-1)?.kind === "reopened" ? `Повторная проверка: ${action.history.at(-1)!.reason}\n` : ""}\nПосле выполнения запишите, что удалось подтвердить и какое решение принято.`,
      RESPONSIBLE_ID: responsibleId,
      DEADLINE: action.dueOn + "T18:00:00+03:00",
    },
  };
}
export async function createBitrixTask(
  webhook: string,
  payload: ReturnType<typeof buildBitrixTask>,
  transport: typeof fetch = fetch,
): Promise<BitrixReceipt> {
  const base = parseWebhook(webhook);
  const r = await transport(new URL("tasks.task.add.json", base).href, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok || data.error)
    throw Error(
      "Битрикс24 не подтвердил создание задачи. Проверьте права вебхука и обязательные поля портала.",
    );
  const id = Number(data.result?.task?.id);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw Error(
      "Битрикс24 не вернул номер задачи. Проверьте портал перед повторной попыткой.",
    );
  return {
    taskId: id,
    url: `${base.origin}/company/personal/user/${payload.fields.RESPONSIBLE_ID}/tasks/task/view/${id}/`,
  };
}
