"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Send, LoaderCircle } from "lucide-react";
import type { Action, Employee } from "../../lib/contracts";
import {
  BitrixReceiptSchema,
  loadBitrixReceipt,
  buildBitrixTask,
  type BitrixReceipt,
} from "../../lib/bitrix";
import { formatDate } from "../../lib/format";
export default function BitrixTask({
  action,
  employee,
}: {
  action: Action;
  employee?: Employee;
}) {
  const [config, setConfig] = useState<{
    configured: boolean;
    portal: string | null;
  } | null>(null);
  const [show, setShow] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [receipt, setReceipt] = useState<BitrixReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const lock = useRef(false);
  const key =
    "newcomers:bitrix:v1:" + action.datasetFingerprint + ":" + action.id;
  useEffect(() => {
    const stored = loadBitrixReceipt(key);
    setReceipt(stored.receipt);
    if (!stored.available)
      setWarning(
        "Браузер не позволяет прочитать сохранённую ссылку. Перед отправкой проверьте, нет ли задачи в Битрикс24.",
      );
    const controller = new AbortController();
    fetch("/api/bitrix/tasks", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const next = await r.json();
        setConfig(next);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Не удалось проверить подключение к Битрикс24. Обновите страницу.",
          );
      });
    return () => controller.abort();
  }, [key]);
  async function send() {
    if (lock.current || receipt) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/bitrix/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, responsibleId: Number(recipient) }),
      });
      const json = await r.json();
      if (!r.ok) throw Error(json.error || "Создание задачи не подтверждено.");
      const next = BitrixReceiptSchema.parse(json);
      setReceipt(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        setWarning(
          "Задача создана, но браузер не сохранил ссылку. Сохраните её перед закрытием страницы.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Ответ не получен. Проверьте портал перед повторной попыткой.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const preview = buildBitrixTask(
    action,
    employee?.fullName ?? action.employeeId,
    Number.isSafeInteger(Number(recipient)) && Number(recipient) > 0
      ? Number(recipient)
      : 1,
  ).fields;
  if (action.status !== "open" && !receipt) return null;
  return (
    <section className="bitrix-panel" aria-label="Поручение в Битрикс24">
      <div className="bitrix-heading">
        <h3>Битрикс24</h3>
        <span className="ai-origin">
          {receipt
            ? `Задача №${receipt.taskId}`
            : config?.configured
              ? "Вебхук настроен"
              : config
                ? "Не подключён"
                : "Проверка подключения…"}
        </span>
      </div>
      {receipt ? (
        <>
          <a
            className="button secondary full"
            href={receipt.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть задачу <ExternalLink size={16} />
          </a>
          <p className="field-help">
            Статус задачи здесь не синхронизируется. Результат проверки запишите
            ниже. Если поручение возвращено в работу, обновите существующую
            задачу по ссылке.
          </p>
        </>
      ) : (
        <>
          <p className="field-help">
            {config?.configured
              ? "Создайте задачу по сохранённому плану. Перед отправкой проверьте получателя и срок."
              : "В этом примере можно посмотреть, как поручение будет выглядеть в рабочей системе."}
          </p>
          <button
            className="button secondary full"
            disabled={!config}
            onClick={() => setShow(!show)}
            aria-expanded={show}
          >
            {show
              ? "Скрыть задачу"
              : config?.configured
                ? "Подготовить задачу в Битрикс24"
                : "Посмотреть пример задачи"}
          </button>
          {show && (
            <form
              className="bitrix-preview"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <span className="ai-origin">
                {config?.configured
                  ? "Перед созданием"
                  : "Предварительный просмотр · без отправки"}
              </span>
              <h4>{preview.TITLE}</h4>
              <p className="preserve-lines">{preview.DESCRIPTION}</p>
              <dl>
                <dt>Ответственный по плану</dt>
                <dd>{action.owner}</dd>
                <dt>Срок</dt>
                <dd>{formatDate(action.dueOn)} · 18:00 МСК</dd>
              </dl>
              {action.history?.at(-1)?.kind === "reopened" && (
                <p>Повторная проверка: {action.history.at(-1)?.reason}</p>
              )}
              {config?.configured ? (
                <>
                  <label htmlFor="bitrix-recipient">
                    ID ответственного в Битрикс24
                  </label>
                  <input
                    id="bitrix-recipient"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    required
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                  <p className="field-help">
                    Число из адреса профиля сотрудника. Имя из плана
                    автоматически с пользователем портала не связывается.
                    Портал: {config.portal}
                  </p>
                  <button
                    className="button primary full"
                    disabled={busy || !!receipt}
                    type="submit"
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Send size={16} />
                    )}{" "}
                    {busy ? "Создаём задачу…" : "Создать задачу в Битрикс24"}
                  </button>
                </>
              ) : (
                <p className="local-note">
                  Задача не создана, уведомлений нет. Для отправки администратор
                  должен настроить входящий вебхук. Поручение также можно
                  скопировать кнопкой ниже.
                </p>
              )}
            </form>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {warning && (
        <p className="notice" role="status">
          {warning}
        </p>
      )}
    </section>
  );
}
