import { describe, expect, it } from "vitest";
import { makeSelfStudyAttendanceRecordId, makeSelfStudyGroupPeriodId, makeSelfStudyMembershipId, makeSelfStudyPermissionId, makeSupervisionAssignmentId } from "../domain/ids";
import { SELF_STUDY_ATTENDANCE_LABELS, buildSelfStudyAttendanceRows, canUseExcusedAbsence, resolveSelfStudyAttendanceStatus } from "../domain/selfStudyOperation";
import { buildSelfStudyGroup, buildSelfStudyGroupPeriod, buildSelfStudyMembership, buildSelfStudyPermission, buildSupervisionAssignment, supervisedGroupIdsForTeacher } from "../services/selfStudyOperations";
import { buildSelfStudyAttendanceRecord } from "../services/selfStudyAttendance";
import type { SelfStudyPermission } from "../types/domain";

const scope = { academicYearId: "2026", gradeId: "2026-1" };

describe("self-study operation domain", () => {
  it("keeps groups scoped and maps arbitrary, non-contiguous periods", () => {
    const group = buildSelfStudyGroup({ ...scope, displayName: "Regular A", type: "REGULAR", active: true, sortOrder: 1 });
    const p1 = buildSelfStudyGroupPeriod({ ...scope, groupId: "group-a", periodId: "p1", active: true });
    const p4 = buildSelfStudyGroupPeriod({ ...scope, groupId: "group-a", periodId: "p4", active: true });
    expect(group.displayName).toBe("Regular A");
    expect([p1.periodId, p4.periodId]).toEqual(["p1", "p4"]);
    expect(makeSelfStudyGroupPeriodId("group-a", "p4")).toBe("group-a_p4");
  });

  it("keeps membership separate from the official class and student identity", () => {
    const membership = buildSelfStudyMembership({ ...scope, studentId: "student-1", classId: "class-1", selfStudyGroupId: "group-reading", active: true });
    expect(membership.classId).toBe("class-1");
    expect(makeSelfStudyMembershipId("2026", "2026-1", "student-1")).toBe("2026_2026-1_student-1");
  });

  it("uses one deterministic active membership identity per student and keeps reading rooms in the same model", () => {
    const regular = buildSelfStudyMembership({ ...scope, studentId: "student-1", classId: "class-1", selfStudyGroupId: "regular", active: true });
    const reading = buildSelfStudyMembership({ ...scope, studentId: "student-1", classId: "class-1", selfStudyGroupId: "reading", active: true });
    expect(makeSelfStudyMembershipId(scope.academicYearId, scope.gradeId, regular.studentId)).toBe(makeSelfStudyMembershipId(scope.academicYearId, scope.gradeId, reading.studentId));
    expect(reading.selfStudyGroupId).toBe("reading");
  });

  it("supports multiple teachers per group-period and multiple groups per teacher", () => {
    const first = buildSupervisionAssignment({ ...scope, date: "2026-09-16", periodId: "p1", selfStudyGroupId: "group-a", teacherUid: "teacher-a", teacherDisplayName: "Teacher A", active: true });
    const second = buildSupervisionAssignment({ ...scope, date: "2026-09-16", periodId: "p1", selfStudyGroupId: "group-a", teacherUid: "teacher-b", teacherDisplayName: "Teacher B", active: true });
    const third = buildSupervisionAssignment({ ...scope, date: "2026-09-16", periodId: "p1", selfStudyGroupId: "group-b", teacherUid: "teacher-a", teacherDisplayName: "Teacher A", active: true });
    expect(new Set([makeSupervisionAssignmentId(first.gradeId, first.date, first.periodId, first.selfStudyGroupId, first.teacherUid), makeSupervisionAssignmentId(second.gradeId, second.date, second.periodId, second.selfStudyGroupId, second.teacherUid), makeSupervisionAssignmentId(third.gradeId, third.date, third.periodId, third.selfStudyGroupId, third.teacherUid)]).size).toBe(3);
  });

  it("prepares only a supervisor's active groups for one date and period", () => {
    const assignments = [
      { id: "a", ...scope, date: "2026-09-16", periodId: "p1", selfStudyGroupId: "group-a", teacherUid: "teacher-a", teacherDisplayName: "Teacher A", active: true },
      { id: "b", ...scope, date: "2026-09-16", periodId: "p1", selfStudyGroupId: "group-b", teacherUid: "teacher-a", teacherDisplayName: "Teacher A", active: true },
      { id: "c", ...scope, date: "2026-09-16", periodId: "p1", selfStudyGroupId: "group-c", teacherUid: "teacher-b", teacherDisplayName: "Teacher B", active: true },
      { id: "d", ...scope, date: "2026-09-16", periodId: "p2", selfStudyGroupId: "group-d", teacherUid: "teacher-a", teacherDisplayName: "Teacher A", active: true },
      { id: "e", ...scope, date: "2026-09-16", periodId: "p1", selfStudyGroupId: "group-e", teacherUid: "teacher-a", teacherDisplayName: "Teacher A", active: false },
    ];
    expect(supervisedGroupIdsForTeacher(assignments, "teacher-a", "2026-09-16", "p1")).toEqual(["group-a", "group-b"]);
  });

  it("keeps permissions scoped to a class/student/date and requires a matching period", () => {
    const permission = buildSelfStudyPermission({ ...scope, classId: "class-1", studentId: "student-1", date: "2026-09-16", periodIds: ["p2", "p4"], reasonCode: "MEDICAL", reasonText: "Clinic", active: true, approvedByUid: "home-1" });
    const stored: SelfStudyPermission = { id: makeSelfStudyPermissionId("2026", "2026-1", "student-1", "2026-09-16"), ...permission };
    expect(canUseExcusedAbsence(stored, "p2")).toBe(true);
    expect(canUseExcusedAbsence(stored, "p1")).toBe(false);
  });

  it("builds a UI-independent row model and keeps the D3 status enum Korean-labelled", () => {
    const rows = buildSelfStudyAttendanceRows([{ id: "student-1", ...scope, classId: "class-1", studentNo: 1, name: "Student", active: true }], [{ id: "member", ...scope, studentId: "student-1", classId: "class-1", selfStudyGroupId: "group-a", active: true }], []);
    expect(rows[0]).toMatchObject({ selfStudyGroupId: "group-a", permission: null, status: null });
    expect(SELF_STUDY_ATTENDANCE_LABELS.EXCUSED_ABSENCE).toBe("인정 결석");
  });

  it("uses one deterministic D3 attendance identity per student, date, and period", () => {
    expect(makeSelfStudyAttendanceRecordId("2026", "2026-1", "2026-09-18", "p1", "student-1")).toBe("2026_2026-1_2026-09-18_p1_student-1");
    expect(makeSelfStudyAttendanceRecordId("2026", "2026-1", "2026-09-18", "p1", "student-1")).not.toBe(makeSelfStudyAttendanceRecordId("2026", "2026-1", "2026-09-18", "p2", "student-1"));
  });

  it("keeps permission as an absence reason, not an automatic absence", () => {
    const permission: SelfStudyPermission = { id: "permission", ...scope, classId: "class-1", studentId: "student-1", date: "2026-09-18", periodIds: ["p1"], reasonCode: "MEDICAL", reasonText: "Clinic", active: true, approvedByUid: "home" };
    expect(resolveSelfStudyAttendanceStatus(false, permission, "p1")).toBe("PRESENT");
    expect(resolveSelfStudyAttendanceStatus(true, permission, "p1")).toBe("EXCUSED_ABSENCE");
    expect(resolveSelfStudyAttendanceStatus(true, permission, "p2")).toBe("UNEXCUSED_ABSENCE");
  });

  it("requires an immutable reason snapshot for excused absence records", () => {
    const record = buildSelfStudyAttendanceRecord({ ...scope, date: "2026-09-18", periodId: "p1", studentId: "student-1", classId: "class-1", selfStudyGroupId: "group-a", status: "EXCUSED_ABSENCE", permissionId: "permission", permissionReasonCode: "MEDICAL", permissionReasonText: "Clinic", recordedByUid: "teacher", updatedByUid: "teacher", schemaVersion: 1 });
    expect(record.permissionReasonText).toBe("Clinic");
    expect(() => buildSelfStudyAttendanceRecord({ ...record, status: "PRESENT" })).toThrow();
  });
});
