import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  AnalysisSchema,
  type Dataset,
  type AnalysisEnvelope,
} from "../contracts";
import { parseDataset, datasetFingerprint } from "../dataset";
import { calculateMetrics } from "../metrics";
import { validateEvidence } from "../evidence";
import { SYSTEM_PROMPT, PROMPT_VERSION } from "./prompt";
export function buildRequest(data: Dataset, model: string) {
  return {
    model,
    store: false as const,
    max_output_tokens: 3000,
    reasoning: { effort: "low" as const },
    input: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: JSON.stringify({
          dataset: data,
          calculatedMetrics: calculateMetrics(data),
        }),
      },
    ],
    text: { format: zodTextFormat(AnalysisSchema, "newcomer_analysis") },
  };
}
export async function analyzeDataset(
  input: Dataset,
  options: { apiKey: string; model: string },
  client?: Pick<OpenAI, "responses">,
): Promise<AnalysisEnvelope> {
  const data = parseDataset(input);
  const openai =
    client ??
    new OpenAI({ apiKey: options.apiKey, maxRetries: 0, timeout: 45000 });
  const response = await openai.responses.parse(
    buildRequest(data, options.model),
  );
  if (response.status !== "completed" || !response.output_parsed)
    throw new Error(
      "Модель не завершила разбор. Предыдущий результат сохранён.",
    );
  return {
    datasetFingerprint: await datasetFingerprint(data),
    model: options.model,
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    analysis: validateEvidence(data, response.output_parsed),
  };
}
