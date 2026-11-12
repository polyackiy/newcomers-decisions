export const employee = (id = "N-001") => ({
  id,
  department: "Склад",
  role: "Комплектовщик",
  startedOn: "2026-07-01",
  employmentIntent: "permanent",
  plannedEndOn: null,
  endedOn: null,
  exitOutcome: null,
  hireRecordId: `hire-${id}`,
  exitRecordId: null,
});
export const dataset = () => ({
  schemaVersion: 1,
  asOf: "2026-11-12",
  employees: [employee()],
  records: [
    {
      id: "hire-N-001",
      employeeId: "N-001",
      kind: "hire",
      createdOn: "2026-07-01",
      updatedOn: "2026-07-01",
      status: "closed",
      text: "Выход на постоянную работу.",
    },
  ],
});
export const clone = <T>(x: T): T => structuredClone(x);
