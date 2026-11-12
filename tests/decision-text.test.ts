import { expect, it } from "vitest";
import { acceptAction, completeAction, reopenAction } from "../lib/actions";
import { buildPlanText } from "../lib/decision-text";
it("includes the current follow-up request in copied reopened plans without copying obsolete outcomes", () => {
  const now = "2026-11-12T12:00:00Z";
  let actions = acceptAction(
    {
      datasetFingerprint: "test",
      employeeId: "one",
      sourceRecordIds: [],
      title: "Original task",
      owner: "Manager",
      dueOn: "2026-11-13",
    },
    [],
    now,
  );
  actions = completeAction(actions[0].id, "Obsolete result", actions, now);
  actions = reopenAction(
    actions[0].id,
    "Verify independent packing",
    actions,
    now,
  );
  const text = buildPlanText(
    { fullName: "Test Employee", role: "Packer" },
    actions[0],
  );
  expect(text).toContain("Original task");
  expect(text).toContain("Verify independent packing");
  expect(text).toContain("Manager");
  expect(text).not.toContain("Obsolete result");
  actions = completeAction(actions[0].id, "Finished", actions, now);
  expect(buildPlanText(undefined, actions[0])).not.toContain(
    "Verify independent packing",
  );
});
