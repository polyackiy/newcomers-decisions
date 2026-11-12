import { z } from "zod";
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Нужна дата ГГГГ-ММ-ДД")
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Несуществующая дата");
const id = z.string().trim().min(1).max(100);
export const EmployeeSchema = z
  .object({
    id,
    fullName: z.string().trim().min(1).max(100).optional(),
    mentor: z.string().trim().min(1).max(100).optional(),
    manager: z.string().trim().min(1).max(100).optional(),
    department: z.string().trim().min(1).max(100),
    role: z.string().trim().min(1).max(150),
    startedOn: dateOnly,
    employmentIntent: z.enum(["permanent", "temporary", "unknown"]),
    plannedEndOn: dateOnly.nullable(),
    endedOn: dateOnly.nullable(),
    exitOutcome: z
      .enum(["planned_completion", "early_departure", "unknown"])
      .nullable(),
    hireRecordId: id,
    exitRecordId: id.nullable(),
  })
  .strict();
export const SourceRecordSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(150).optional(),
    author: z.string().trim().min(1).max(100).optional(),
    employeeId: id,
    kind: z.enum(["hire", "exit", "adaptation"]),
    createdOn: dateOnly,
    updatedOn: dateOnly,
    status: z.enum(["open", "closed"]),
    text: z.string().trim().min(1).max(1000),
  })
  .strict();
export const DatasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    asOf: dateOnly,
    employees: z.array(EmployeeSchema).max(100),
    records: z.array(SourceRecordSchema).max(200),
  })
  .strict();
export const AnalysisSchema = z
  .object({
    findings: z.array(
      z
        .object({
          employeeId: z.string(),
          category: z.enum(["access", "schedule", "exit_reason", "unknown"]),
          observations: z.array(
            z
              .object({
                text: z.string(),
                kind: z.enum(["reported", "hypothesis"]),
                citations: z.array(
                  z
                    .object({ recordId: z.string(), quote: z.string() })
                    .strict(),
                ),
              })
              .strict(),
          ),
          unknowns: z.array(z.string()),
          suggestedAction: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export const EnvelopeSchema = z
  .object({
    datasetFingerprint: z.string(),
    model: z.string(),
    promptVersion: z.string(),
    generatedAt: z.string().datetime(),
    analysis: AnalysisSchema,
  })
  .strict();
export const ActionSchema = z
  .object({
    id: z.string().min(1),
    datasetFingerprint: z.string().min(1),
    employeeId: id,
    sourceRecordIds: z.array(id),
    title: z.string().trim().min(1).max(800),
    owner: z.string().trim().min(1).max(100),
    dueOn: dateOnly,
    status: z.enum(["open", "done", "dismissed"]),
    outcome: z.string().nullable(),
    history: z
      .array(
        z
          .object({
            status: z.enum(["done", "dismissed"]),
            outcome: z.string().nullable(),
            recordedAt: z.string(),
            changedAt: z.string(),
            kind: z.enum(["correction", "reopened"]),
            reason: z.string(),
          })
          .strict(),
      )
      .optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type Dataset = z.infer<typeof DatasetSchema>;
export type Employee = z.infer<typeof EmployeeSchema>;
export type SourceRecord = z.infer<typeof SourceRecordSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
export type Finding = Analysis["findings"][number];
export type AnalysisEnvelope = z.infer<typeof EnvelopeSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type ActionDraft = Pick<
  Action,
  | "datasetFingerprint"
  | "employeeId"
  | "sourceRecordIds"
  | "title"
  | "owner"
  | "dueOn"
>;
export type Metrics = {
  total: number;
  mature: number;
  recent: number;
  maturePermanent: number;
  earlyPermanent: number;
  confirmedPlanned: number;
  unresolvedEarly: number;
  earlyPermanentRate: number | null;
};
export type CaseView = {
  employeeId: string;
  title: string;
  priority: "check_now" | "review" | "unknown";
  sourceRecordIds: string[];
  findings: Finding[];
  action: Action | null;
};
