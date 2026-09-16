export type LegacyUserRole =
  | "system_owner"
  | "grade_admin"
  | "homeroom_teacher"
  | "teacher";

export type GlobalRole = "teacher" | "system_owner";
export type StaffRole = "teacher" | "grade_admin";
export type UserRole = LegacyUserRole;

export interface AcademicYear {
  id: string;
  displayName: string;
  active: boolean;
  isCurrent: boolean;
}

export interface Grade {
  id: string;
  academicYearId: string;
  gradeNumber: number;
  displayName: string;
  active: boolean;
}

export interface Scope {
  academicYearId: string;
  gradeId: string;
}

/** A gradeId of null is reserved for a system owner's whole-year view. */
export interface SchoolScope {
  academicYearId: string;
  gradeId: string | null;
}

export interface StaffAssignment extends Scope {
  id: string;
  uid: string;
  role: StaffRole;
  active: boolean;
  /** Non-authoritative display snapshot for scoped candidate lists. */
  displayName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "excused"
  | "early_leave";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  /** Global identity roles. Only system_owner has cross-year authority. */
  globalRoles?: GlobalRole[];
  /** Read-only compatibility for pre-v0.7 account documents. Never use for scoped authorization. */
  roles: LegacyUserRole[];
  active: boolean;
  homeroomClassId?: string;
}

export interface PendingUser {
  uid: string;
  email: string;
  displayName: string;
  provider: "google";
  createdAt?: unknown;
  lastLoginAt?: unknown;
}

export interface ClassRoom {
  id: string;
  /** Required for new scoped records; absent only on legacy v0.6 documents. */
  academicYearId?: string;
  /** Required for new scoped records; absent only on legacy v0.6 documents. */
  gradeId?: string;
  /** Required for new scoped records; classNo is retained for legacy reads. */
  classNumber?: number;
  /** Compatibility field for legacy imports. */
  grade?: number;
  /** Compatibility field for legacy imports. */
  classNo?: number;
  displayName: string;
  homeroomTeacherUid?: string;
  homeroomTeacherName?: string;
  active: boolean;
}

export interface ScopedClassRoom extends ClassRoom {
  academicYearId: string;
  gradeId: string;
  classNumber: number;
}

export interface Student {
  id: string;
  academicYearId?: string;
  gradeId?: string;
  studentNo: number;
  name: string;
  classId: string;
  active: boolean;
}

export interface ScopedStudent extends Student {
  academicYearId: string;
  gradeId: string;
}

export interface Period {
  id: string;
  academicYearId?: string;
  gradeId?: string;
  name: string;
  order: number;
  startTime: string;
  endTime: string;
  active: boolean;
}

export interface DutyPeriodAssignment {
  teacherUid: string;
  teacherName: string;
  teacherEmail?: string;
  editableFrom?: unknown;
  editableUntil?: unknown;
}

export interface DutyAssignment {
  academicYearId?: string;
  gradeId?: string;
  date: string;
  periods: Record<string, DutyPeriodAssignment>;
  // Read compatibility for legacy date-level documents during the data migration.
  teacherName?: string;
  source?: "manual" | "excel";
  updatedBy?: string;
  updatedAt?: unknown;
}

export type SelfStudyExceptionReasonType = "holiday" | "exam" | "school_event" | "manual";

export interface SelfStudyException {
  academicYearId?: string;
  gradeId?: string | null;
  scopeType?: "school" | "grade";
  date: string;
  reasonType: SelfStudyExceptionReasonType;
  reason: string;
  /** New scoped field. enabled is retained for legacy v0.6 documents. */
  active?: boolean;
  enabled?: boolean;
}

export interface AttendanceRecord {
  id?: string;
  academicYearId?: string;
  gradeId?: string;
  date: string;
  studentId: string;
  classId: string;
  periodId: string;
  status: AttendanceStatus;
  note: string;
  markedBy: string;
  markedAt: unknown;
  updatedAt: unknown;
}

/** D3 attendance uses this separate, intentionally narrower operation status set. */
export type SelfStudyAttendanceStatus = "PRESENT" | "EXCUSED_ABSENCE" | "UNEXCUSED_ABSENCE";

export type SelfStudyGroupType = "REGULAR" | "READING";

export interface SelfStudyGroup extends Scope {
  id: string;
  displayName: string;
  type: SelfStudyGroupType;
  active: boolean;
  sortOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** An enabled edge between a scoped self-study group and a grade-level period. */
export interface SelfStudyGroupPeriod extends Scope {
  id: string;
  groupId: string;
  periodId: string;
  active: boolean;
  updatedAt?: unknown;
}

/** Class enrolment remains authoritative; this only records the self-study grouping. */
export interface SelfStudyMembership extends Scope {
  id: string;
  studentId: string;
  classId: string;
  selfStudyGroupId: string;
  active: boolean;
  updatedAt?: unknown;
}

/** A teacher-to-group-to-period edge. Multiple edges can exist for a group and period. */
export interface SupervisionAssignment extends Scope {
  id: string;
  date: string;
  periodId: string;
  selfStudyGroupId: string;
  teacherUid: string;
  teacherDisplayName: string;
  active: boolean;
  updatedAt?: unknown;
}

export type SelfStudyPermissionReasonCode = "ACADEMY" | "MEDICAL" | "FAMILY" | "SCHOOL_ACTIVITY" | "OTHER";

export interface SelfStudyPermission extends Scope {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  periodIds: string[];
  reasonCode: SelfStudyPermissionReasonCode;
  reasonText: string;
  active: boolean;
  approvedByUid: string;
  approvedAt?: unknown;
  updatedAt?: unknown;
}

export interface SelfStudyAttendanceRow {
  studentId: string;
  studentName: string;
  classId: string;
  selfStudyGroupId: string | null;
  permission: Pick<SelfStudyPermission, "reasonCode" | "reasonText" | "periodIds"> | null;
  status: SelfStudyAttendanceStatus | null;
}

export interface AccessSettings {
  statsVisibility: "grade_admin_only" | "grade_admin_and_homeroom";
  homeroomStatsScope: "own_class" | "grade";
}

export type EmergencyMode =
  | "NORMAL"
  | "READ_ONLY"
  | "ESSENTIAL_ONLY"
  | "MAINTENANCE"
  | "LOCKDOWN";

export interface MaintenanceSettings {
  enabled: boolean;
  title: string;
  message: string;
  noticeFrom: unknown | null;
  startsAt: unknown | null;
  endsAt: unknown | null;
  bannerEnabled: boolean;
  popupEnabled: boolean;
}

/** Operational controls are intentionally separate from access-policy settings. */
export interface OperationsSettings {
  emergencyMode: EmergencyMode;
  emergencyMessage: string;
  maintenance: MaintenanceSettings;
  updatedAt?: unknown;
  updatedBy: string;
}

export interface AuditLog {
  id?: string;
  action: string;
  actorUid: string;
  actorName: string;
  targetType: string;
  targetId: string;
  before?: object | null;
  after?: object | null;
  source?: "manual" | "excel" | "system";
  batchId?: string;
  batchSize?: number;
  academicYearId?: string;
  gradeId?: string;
  classId?: string;
  timestamp?: unknown;
}
