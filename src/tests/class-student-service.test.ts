import { describe, expect, it } from "vitest";
import { canAssignHomeroomTeacher, filterClassesForScope, filterStudentsForScope } from "../domain/scope";
import { auditEventData } from "../services/audit";
import { buildScopedStudentImportPreview } from "../services/scopedStudents";
import type { ClassRoom, ScopedClassRoom } from "../types/domain";
import type { StaffAssignment, Student } from "../types/domain";

const classes: ScopedClassRoom[] = [
  { id: "2026-2-1", academicYearId: "2026", gradeId: "2026-2", classNumber: 1, displayName: "2-1", active: true },
  { id: "2026-1-1", academicYearId: "2026", gradeId: "2026-1", classNumber: 1, displayName: "1-1", active: true },
  { id: "2027-2-1", academicYearId: "2027", gradeId: "2027-2", classNumber: 1, displayName: "2-1", active: true },
];
const students: Student[] = [
  { id: "s1", academicYearId: "2026", gradeId: "2026-2", classId: "2026-2-1", studentNo: 1, name: "A", active: true },
  { id: "s2", academicYearId: "2026", gradeId: "2026-1", classId: "2026-1-1", studentNo: 1, name: "B", active: true },
];
const assignments: StaffAssignment[] = [
  { id: "same", academicYearId: "2026", gradeId: "2026-2", uid: "teacher", role: "teacher", active: true },
  { id: "inactive", academicYearId: "2026", gradeId: "2026-2", uid: "inactive", role: "teacher", active: false },
  { id: "other", academicYearId: "2026", gradeId: "2026-1", uid: "other", role: "teacher", active: true },
];

describe("scoped class and student service contracts", () => {
  it("keeps class and student lists within academic year and grade", () => {
    expect(filterClassesForScope(classes, { academicYearId: "2026", gradeId: "2026-2" }).map((item) => item.id)).toEqual(["2026-2-1"]);
    expect(filterStudentsForScope(students, { academicYearId: "2026", gradeId: "2026-2" }).map((item) => item.id)).toEqual(["s1"]);
  });

  it("allows only an active same-grade staff assignment as homeroom candidate", () => {
    const classRoom: ClassRoom = { ...classes[0] };
    expect(canAssignHomeroomTeacher(classRoom, assignments, "teacher")).toBe(true);
    expect(canAssignHomeroomTeacher(classRoom, assignments, "inactive")).toBe(false);
    expect(canAssignHomeroomTeacher(classRoom, assignments, "other")).toBe(false);
  });

  it("binds Excel preview metadata to the selected scope and rejects foreign classes", () => {
    const summary = {
      rows: [
        { rowNo: 2, classId: "2026-2-1", studentNo: 1, name: "A", change: "new" as const },
        { rowNo: 3, classId: "2026-1-1", studentNo: 1, name: "B", change: "new" as const },
      ], newCount: 2, updateCount: 0, unchangedCount: 0, conflictCount: 0, errorCount: 0,
    };
    const preview = buildScopedStudentImportPreview({ academicYearId: "2026", gradeId: "2026-2" }, summary, classes);
    expect(preview.academicYearId).toBe("2026");
    expect(preview.gradeId).toBe("2026-2");
    expect(preview.rows[0].change).toBe("new");
    expect(preview.rows[1].change).toBe("error");
  });

  it("adds optional scoped audit metadata without changing legacy events", () => {
    const data = auditEventData({ actor: { uid: "owner", name: "Owner" }, action: "CLASS_CREATED", targetType: "class", targetId: "2026-2-1", academicYearId: "2026", gradeId: "2026-2", classId: "2026-2-1" });
    expect(data).toMatchObject({ academicYearId: "2026", gradeId: "2026-2", classId: "2026-2-1" });
  });
});
