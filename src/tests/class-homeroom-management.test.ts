import { describe, expect, it } from "vitest";
import { makeClassId } from "../domain/ids";
import { buildHomeroomCandidates } from "../services/classes";
import type { ScopedClassRoom, StaffAssignment } from "../types/domain";

const assignments: StaffAssignment[] = [
  { id: "a", academicYearId: "2026", gradeId: "2026-2", uid: "teacher-a", displayName: "Teacher A", role: "teacher", active: true },
  { id: "b", academicYearId: "2026", gradeId: "2026-2", uid: "teacher-b", displayName: "Teacher B", role: "grade_admin", active: true },
  { id: "c", academicYearId: "2026", gradeId: "2026-2", uid: "inactive", displayName: "Inactive", role: "teacher", active: false },
];

describe("scoped class and homeroom contracts", () => {
  it("uses a deterministic class ID without using the display name", () => {
    expect(makeClassId("2026", "2026-2", 3)).toBe("2026_2026-2_3");
    expect(makeClassId("2027", "2027-2", 3)).not.toBe(makeClassId("2026", "2026-2", 3));
  });

  it("keeps active same-scope staff candidates and excludes inactive assignments", () => {
    const candidates = buildHomeroomCandidates(assignments, [null, null]);
    expect(candidates.map((candidate) => candidate.uid)).toEqual(["teacher-a", "teacher-b"]);
    expect(candidates.map((candidate) => candidate.displayName)).toEqual(["Teacher A", "Teacher B"]);
  });

  it("marks a same-year lock as a conflict while keeping different-year locks independent", () => {
    const candidates = buildHomeroomCandidates(assignments, [{ academicYearId: "2026", gradeId: "2026-1", uid: "teacher-a", classId: "other-class", classDisplayName: "1학년 1반" }, null]);
    expect(candidates[0]).toMatchObject({ conflictClassId: "other-class", conflictClassName: "1학년 1반" });
    expect(candidates[1].conflictClassId).toBeUndefined();
  });

  it("does not derive homeroom authority from a legacy account role", () => {
    expect(assignments.some((assignment) => assignment.role === "grade_admin" && assignment.uid === "teacher-a")).toBe(false);
    expect(assignments[0].displayName).toBe("Teacher A");
  });
});
