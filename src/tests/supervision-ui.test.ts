import { describe, expect, it } from "vitest";
import { buildSupervisionImportPreview, canCommitSupervisionImport, supervisionDaySummary, validateSupervisionImportRow } from "../domain/supervisionUi";
const scope={academicYearId:"2026",gradeId:"2026-2"};const period:any={...scope,id:"p1",name:"\uC790\uC2B5 1\uAD50\uC2DC",active:true,operatingDays:[0,6],startTime:"18:00",endTime:"18:50"};const group:any={...scope,id:"g1",displayName:"A",active:true};const teacher:any={...scope,uid:"t1",displayName:"\uAE40\uAD50\uC0AC",active:true,role:"teacher"};
describe("supervision UI helpers",()=>{it("counts assigned and missing calendar slots including Sunday",()=>expect(supervisionDaySummary("2026-09-20",[period],[group],[{...scope,id:"edge-1",groupId:"g1",periodId:"p1",active:true}],[])).toEqual({operatingPeriods:1,assigned:0,missing:1}));it("accepts a valid import row",()=>expect(validateSupervisionImportRow({date:"2026-09-20",period:"p1",group:"g1",teacher:"t1"},{periods:[period],groups:[group],edges:[{...scope,id:"edge-1",groupId:"g1",periodId:"p1",active:true}],teachers:[teacher],date:"2026-09-20"})).toBeNull());it("rejects invalid period and ambiguous teacher",()=>{expect(validateSupervisionImportRow({date:"2026-09-20",period:"bad",group:"g1",teacher:"t1"},{periods:[period],groups:[group],edges:[],teachers:[teacher],date:""})).toBeTruthy();expect(validateSupervisionImportRow({date:"2026-09-20",period:"p1",group:"g1",teacher:"\uAE40\uAD50\uC0AC"},{periods:[period],groups:[group],edges:[{...scope,id:"edge-1",groupId:"g1",periodId:"p1",active:true}],teachers:[teacher,{...teacher,uid:"t2"}],date:""})).toBeTruthy();});});
describe("supervision preview regression",()=>{const input={periods:[period],groups:[group],edges:[{...scope,id:"edge-1",groupId:"g1",periodId:"p1",active:true}],teachers:[teacher],date:""};it("maps a fully assigned calendar and a non-operating day",()=>{const edge={...scope,id:"edge-1",groupId:"g1",periodId:"p1",active:true};const assignment={...scope,id:"a",date:"2026-09-20",periodId:"p1",selfStudyGroupId:"g1",teacherUid:"t1",teacherDisplayName:"\uAE40\uAD50\uC0AC",active:true};expect(supervisionDaySummary("2026-09-20",[period],[group],[edge],[assignment] as any)).toEqual({operatingPeriods:1,assigned:1,missing:0});expect(supervisionDaySummary("2026-09-21",[period],[group],[edge],[])).toEqual({operatingPeriods:0,assigned:0,missing:0});});it("rejects invalid date, non-operating period, group and missing teacher",()=>{expect(validateSupervisionImportRow({date:"bad",period:"p1",group:"g1",teacher:"t1"},input)).toBeTruthy();expect(validateSupervisionImportRow({date:"2026-09-21",period:"p1",group:"g1",teacher:"t1"},input)).toBeTruthy();expect(validateSupervisionImportRow({date:"2026-09-20",period:"p1",group:"bad",teacher:"t1"},input)).toBeTruthy();expect(validateSupervisionImportRow({date:"2026-09-20",period:"p1",group:"g1",teacher:"bad"},input)).toBeTruthy();});});
describe("supervision import preview", () => {
  const edge = { ...scope, id: "edge-1", groupId: "g1", periodId: "p1", active: true };
  const input = { periods: [period], groups: [group], edges: [edge], teachers: [teacher], month: "2026-09", existing: [] as any[] };
  const row = { "\uB0A0\uC9DC": "2026-09-20", "\uAD50\uC2DC": "p1", "\uC790\uC2B5\uADF8\uB8F9": "g1", "\uAC10\uB3C5\uAD50\uC0AC": "t1" };
  it("marks a clean new row as committable", () => {
    const preview = buildSupervisionImportPreview([row], input);
    expect(preview.map((item) => [item.index, item.status, item.reason])).toEqual([[2, "\uC2E0\uADDC", null]]);
    expect(canCommitSupervisionImport(preview)).toBe(true);
  });
  it("blocks commit when the file repeats a row", () => {
    const preview = buildSupervisionImportPreview([row, row], input);
    expect(preview[1].status).toBe("\uC911\uBCF5");
    expect(canCommitSupervisionImport(preview)).toBe(false);
  });
  it("blocks commit when a teacher name is ambiguous", () => {
    const preview = buildSupervisionImportPreview([{ ...row, "\uAC10\uB3C5\uAD50\uC0AC": "\uAE40\uAD50\uC0AC" }], { ...input, teachers: [teacher, { ...teacher, uid: "t2" }] });
    expect(preview[0].status).toBe("\uC624\uB958");
    expect(canCommitSupervisionImport(preview)).toBe(false);
  });
  it("blocks commit when a date is outside the selected month", () => {
    const preview = buildSupervisionImportPreview([{ ...row, "\uB0A0\uC9DC": "2026-10-04" }], input);
    expect(preview[0].status).toBe("\uC624\uB958");
    expect(preview[0].reason).toBe("\uC120\uD0DD\uD55C \uC6D4 \uBC16\uC758 \uB0A0\uC9DC");
    expect(canCommitSupervisionImport(preview)).toBe(false);
  });
  it("keeps an already saved assignment as unchanged and refuses an empty preview", () => {
    const existing = [{ ...scope, id: "a", date: "2026-09-20", periodId: "p1", selfStudyGroupId: "g1", teacherUid: "t1", active: true }];
    expect(buildSupervisionImportPreview([row], { ...input, existing })[0].status).toBe("\uBCC0\uACBD \uC5C6\uC74C");
    expect(canCommitSupervisionImport([])).toBe(false);
  });
});
