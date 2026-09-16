import { describe, expect, it } from "vitest";
import { summarizeAttendance } from "../domain/statistics";
import type { AttendanceRecord, Student } from "../types/domain";

const students: Student[] = [{ id: "s1", classId: "2-1", studentNo: 1, name: "A", active: true }, { id: "s2", classId: "2-1", studentNo: 2, name: "B", active: false }];
const record = (status: AttendanceRecord["status"], studentId = "s1"): AttendanceRecord => ({ date: "2026-12-31", studentId, classId: "2-1", periodId: "p1", status, note: "", markedBy: "t", markedAt: null, updatedAt: null });

describe("attendance statistics", () => {
  it("counts credited present and excused records without treating unmarked as present", () => {
    const result = summarizeAttendance([record("present"), record("excused"), record("late"), record("absent")], "class", students);
    expect(result[0]).toMatchObject({ total: 4, credited: 2, rate: 50, late: 1, absent: 1 });
  });
  it("groups by student and period", () => {
    expect(summarizeAttendance([record("present")], "student", students)[0].key).toBe("s1");
    expect(summarizeAttendance([record("present")], "period", students)[0].key).toBe("p1");
  });
  it("excludes inactive students by default and supports historical inclusion", () => {
    expect(summarizeAttendance([record("absent", "s2")], "class", students)).toHaveLength(0);
    expect(summarizeAttendance([record("absent", "s2")], "class", students, true)[0].absent).toBe(1);
  });
  it("handles empty data", () => {
    expect(summarizeAttendance([], "class", students)).toEqual([]);
  });
  it("excludes legacy Sunday records from statistics without adding missing attendance", () => {
    const sunday = { ...record("absent"), date: "2026-09-20" };
    expect(summarizeAttendance([record("present"), sunday], "class", students)).toMatchObject([{ total: 1, present: 1, absent: 0 }]);
  });
});
