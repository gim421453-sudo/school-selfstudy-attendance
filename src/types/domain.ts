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
