import { z } from "zod";
import { AnalysisSchema, type CaseView } from "./contracts";
const text = z.string().trim().min(1).max(4000);
const OriginalSchema = z.object({
  summary: z.string().min(1),
  suggestedAction: z.string(),
  origin: z.enum(["ai", "manual"]),
  findings: AnalysisSchema.shape.findings.optional(),
});
const InterpretationSchema = z.object({
  employeeId: z.string().min(1).max(100),
  summary: text,
  suggestedAction: z.string().trim().min(1).max(800),
  original: OriginalSchema,
  updatedAt: z.string().datetime(),
});
export type Interpretation = z.infer<typeof InterpretationSchema>;
export type OriginalInterpretation = z.infer<typeof OriginalSchema>;
export function originalInterpretation(
  item: CaseView,
  ai: boolean,
): OriginalInterpretation {
  return {
    summary:
      item.findings
        .flatMap((f) => f.observations.map((o) => o.text))
        .join("\n\n") || "В записях есть вопросы, которые нужно уточнить.",
    suggestedAction:
      item.findings.find((f) => f.suggestedAction)?.suggestedAction ||
      "Проверить исходные записи и уточнить следующий шаг.",
    origin: ai ? "ai" : "manual",
    findings: item.findings,
  };
}
export function makeInterpretation(
  employeeId: string,
  summary: string,
  suggestedAction: string,
  original: OriginalInterpretation,
  previous?: Interpretation,
  now = new Date().toISOString(),
): Interpretation {
  if (!summary.trim() || !suggestedAction.trim())
    throw Error("Заполните вывод и следующий шаг.");
  return InterpretationSchema.parse({
    employeeId,
    summary,
    suggestedAction,
    original: previous?.original ?? original,
    updatedAt: now,
  });
}
const key = (fingerprint: string) =>
  "newcomers:interpretations:v1:" + fingerprint;
export function loadInterpretations(fingerprint: string): {
  edits: Interpretation[];
  available: boolean;
} {
  try {
    const raw = localStorage.getItem(key(fingerprint));
    return {
      edits: raw ? InterpretationSchema.array().parse(JSON.parse(raw)) : [],
      available: true,
    };
  } catch {
    return { edits: [], available: false };
  }
}
export function saveInterpretations(
  fingerprint: string,
  edits: Interpretation[],
): { persisted: boolean } {
  try {
    localStorage.setItem(
      key(fingerprint),
      JSON.stringify(InterpretationSchema.array().parse(edits)),
    );
    return { persisted: true };
  } catch {
    return { persisted: false };
  }
}
