import { listAcademicYears } from "./academicYears";
import { listClasses } from "./classes";
import { listGrades } from "./grades";
import { listScopedPeriods } from "./scopedPeriods";
import { listScopedStudents } from "./scopedStudents";
import { listAssignmentsForYear } from "./staffAssignments";
import { listSelfStudyGroups, listSelfStudyMemberships } from "./selfStudyOperations";

export interface AcademicYearSetupRow { label: string; count: number; detail: string; ready: boolean; }
export async function getAcademicYearSetup(academicYearId: string): Promise<AcademicYearSetupRow[]> {
  const [years, grades, assignments] = await Promise.all([listAcademicYears(), listGrades(academicYearId), listAssignmentsForYear(academicYearId)]);
  const scoped = await Promise.all(grades.map(async (grade) => {
    const scope={academicYearId,gradeId:grade.id}; const [classes,students,periods,groups,memberships]=await Promise.all([listClasses(academicYearId,grade.id),listScopedStudents(scope),listScopedPeriods(academicYearId,grade.id),listSelfStudyGroups(scope),listSelfStudyMemberships(scope)]);
    return { grade, classes, students, periods, groups, memberships };
  }));
  const classes=scoped.flatMap(x=>x.classes.filter(c=>c.active)); const students=scoped.flatMap(x=>x.students.filter(s=>s.active)); const groups=scoped.flatMap(x=>x.groups.filter(g=>g.active)); const memberships=scoped.flatMap(x=>x.memberships.filter(m=>m.active));
  const gradeAdmins=grades.filter(g=>assignments.some(a=>a.active&&a.gradeId===g.id&&a.role==="grade_admin")); const homerooms=classes.filter(c=>Boolean(c.homeroomTeacherUid));
  return [
    {label:"AcademicYear",count:years.some(y=>y.id===academicYearId)?1:0,detail:academicYearId,ready:years.some(y=>y.id===academicYearId)},
    {label:"Grades",count:grades.filter(g=>g.active).length,detail:`${grades.filter(g=>g.active).length}개 활성 학년`,ready:grades.some(g=>g.active)},
    {label:"StaffAssignment",count:assignments.filter(a=>a.active).length,detail:`학년부 지정 ${gradeAdmins.length}/${grades.length}`,ready:assignments.some(a=>a.active)},
    {label:"Classes",count:classes.length,detail:`담임 지정 ${homerooms.length}/${classes.length}`,ready:classes.length>0},
    {label:"Students",count:students.length,detail:`자습 미배정 ${students.filter(s=>!memberships.some(m=>m.studentId===s.id)).length}명`,ready:students.length>0},
    {label:"Periods",count:scoped.flatMap(x=>x.periods.filter(p=>p.active)).length,detail:"자동 복사 없음",ready:scoped.some(x=>x.periods.some(p=>p.active))},
    {label:"SelfStudyGroups",count:groups.length,detail:`Membership ${memberships.length}건`,ready:groups.length>0},
  ];
}
