import NewcomersApp from "./components/newcomers-app";
import raw from "../data/demo.json";
import saved from "../data/demo-analysis.json";
import manual from "../data/demo-manual.json";
import { parseDataset, datasetFingerprint } from "../lib/dataset";
import { validateEvidence } from "../lib/evidence";
import { EnvelopeSchema } from "../lib/contracts";
export const dynamic = "force-dynamic";
export default async function Page() {
  const dataset = parseDataset(raw);
  const fingerprint = await datasetFingerprint(dataset);
  const parsed = EnvelopeSchema.safeParse(saved);
  const envelope =
    parsed.success && parsed.data.datasetFingerprint === fingerprint
      ? {
          ...parsed.data,
          analysis: validateEvidence(dataset, parsed.data.analysis),
        }
      : null;
  return (
    <NewcomersApp
      initialDataset={dataset}
      initialFingerprint={fingerprint}
      initialEnvelope={envelope}
      manualAnalysis={validateEvidence(dataset, manual)}
      aiEnabled={
        process.env.AI_ENABLED === "true" && !!process.env.OPENAI_API_KEY
      }
    />
  );
}
