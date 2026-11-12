import { readFile, writeFile } from "node:fs/promises";
import { analyzeDataset } from "../lib/ai/server";
import { parseDataset } from "../lib/dataset";
const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error("Настройте OPENAI_API_KEY в .env.local.");
const dataset = parseDataset(
  JSON.parse(await readFile("data/demo.json", "utf8")),
);
const result = await analyzeDataset(dataset, {
  apiKey: key,
  model: process.env.OPENAI_MODEL || "gpt-6.1-terra",
});
await writeFile(
  "data/demo-analysis.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  `Saved verified analysis: ${result.model}, ${result.analysis.findings.length} cases, ${result.generatedAt}`,
);
