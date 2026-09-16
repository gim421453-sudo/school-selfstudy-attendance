import { describe, expect, it } from "vitest";
import { deleteDutyV2PeriodInBatch, dutyV2DayId, dutyV2DayPayload, dutyV2PeriodPayload, reconstructDutyV2Assignment, writeDutyV2PeriodInBatch, type DutyV2Day, type DutyV2Period } from "../services/dutyV2Repository";
import type { WriteBatch } from "firebase/firestore";

const day: DutyV2Day = { academicYearId: "2026", gradeId: "2026-2", date: "2026-09-16", schemaVersion: 2 };
const periods: DutyV2Period[] = [
  { academicYearId: "2026", gradeId: "2026-2", date: "2026-09-16", periodId: "p1", teacherUid: "teacher-a", teacherName: "A" },
  { academicYearId: "2026", gradeId: "2026-2", date: "2026-09-16", periodId: "p2", teacherUid: "teacher-b", teacherName: "B" },
];

describe("Duty V2 repository contract", () => {
  it("uses deterministic parent and period child IDs", () => {
    expect(dutyV2DayId("2026-2", "2026-09-16")).toBe("2026-2_2026-09-16");
    expect(periods[0].periodId).toBe("p1");
  });

  it("reconstructs separate period teachers into the existing DutyAssignment shape", () => {
    const reconstructed = reconstructDutyV2Assignment(day, periods);
    expect(reconstructed).toMatchObject({ academicYearId: "2026", gradeId: "2026-2", date: "2026-09-16" });
    expect(reconstructed?.periods.p1.teacherUid).toBe("teacher-a");
    expect(reconstructed?.periods.p2.teacherUid).toBe("teacher-b");
  });

  it("preserves scope metadata and never creates a dynamic periods map payload", () => {
    expect(dutyV2DayPayload(day)).toEqual({ academicYearId: "2026", gradeId: "2026-2", date: "2026-09-16", schemaVersion: 2 });
    expect(dutyV2PeriodPayload(periods[0])).toMatchObject({ periodId: "p1", teacherUid: "teacher-a", gradeId: "2026-2" });
    expect("periods" in dutyV2DayPayload(day)).toBe(false);
  });

  it("ignores malformed cross-scope children during reconstruction", () => {
    const result = reconstructDutyV2Assignment(day, [...periods, { ...periods[0], periodId: "foreign", gradeId: "2026-1" }]);
    expect(result?.periods.foreign).toBeUndefined();
  });

  it("does not reconstruct a legacy V1 parent as a V2 assignment", () => {
    const legacyParent = { ...day, schemaVersion: 1 } as unknown as DutyV2Day;
    expect(reconstructDutyV2Assignment(legacyParent, periods)).toBeNull();
  });

  it("adds only a V2 parent and selected period child to a caller batch", () => {
    const calls: Array<{ operation: string; data?: Record<string, unknown> }> = [];
    const batch = {
      set: (_ref: unknown, data: Record<string, unknown>) => {
        calls.push({ operation: "set", data });
        return batch;
      },
      delete: () => {
        calls.push({ operation: "delete" });
        return batch;
      },
    } as unknown as WriteBatch;

    writeDutyV2PeriodInBatch(batch, periods[0]);
    deleteDutyV2PeriodInBatch(batch, day, periods[0].periodId);

    expect(calls).toHaveLength(3);
    expect(calls[0].data).toMatchObject({ ...day, schemaVersion: 2 });
    expect(calls[0].data?.periods).toBeUndefined();
    expect(calls[1].data).toMatchObject({ ...periods[0], periodId: "p1" });
    expect(calls[2].operation).toBe("delete");
  });
});
