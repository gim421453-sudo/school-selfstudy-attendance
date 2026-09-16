import { collection, doc, getDocs, orderBy, query, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { AppUser, ClassRoom, UserRole } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

export async function listClasses(): Promise<ClassRoom[]> {
  const snap = await getDocs(query(collection(db, "classes"), orderBy("grade"), orderBy("classNo")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassRoom, "id">) }));
}

export async function saveClassRoom(value: ClassRoom, actor: AuditActor, before?: ClassRoom | null) {
  const batch = writeBatch(db);
  batch.set(doc(db, "classes", value.id), {
    grade: value.grade,
    classNo: value.classNo,
    displayName: value.displayName,
    homeroomTeacherUid: value.homeroomTeacherUid ?? null,
    homeroomTeacherName: value.homeroomTeacherName ?? null,
    active: value.active,
  }, { merge: true });
  appendAuditLog(batch, { actor, action: before ? "CLASS_UPDATE" : "CLASS_CREATE", targetType: "class", targetId: value.id, before: before ?? null, after: value });
  await batch.commit();
}

function withHomeroomRole(roles: UserRole[], enabled: boolean): UserRole[] {
  const without = roles.filter((role) => role !== "homeroom_teacher");
  return enabled ? [...without, "homeroom_teacher"] : without;
}

export async function assignHomeroom(input: {
  classRoom: ClassRoom;
  teacher: AppUser | null;
  allClasses: ClassRoom[];
  allUsers: AppUser[];
  actor: AuditActor;
}) {
  const batch = writeBatch(db);
  const previousUid = input.classRoom.homeroomTeacherUid;
  const next = input.teacher;
  batch.set(doc(db, "classes", input.classRoom.id), {
    homeroomTeacherUid: next?.uid ?? null,
    homeroomTeacherName: next?.displayName ?? null,
  }, { merge: true });
  if (next) {
    if (next.homeroomClassId && next.homeroomClassId !== input.classRoom.id) {
      batch.set(doc(db, "classes", next.homeroomClassId), { homeroomTeacherUid: null, homeroomTeacherName: null }, { merge: true });
    }
    batch.set(doc(db, "users", next.uid), { homeroomClassId: input.classRoom.id, roles: withHomeroomRole(next.roles, true) }, { merge: true });
  }
  if (previousUid && previousUid !== next?.uid) {
    const previous = input.allUsers.find((user) => user.uid === previousUid);
    const hasOtherClass = input.allClasses.some((classRoom) => classRoom.id !== input.classRoom.id && classRoom.homeroomTeacherUid === previousUid);
    batch.set(doc(db, "users", previousUid), {
      homeroomClassId: null,
      ...(previous && !hasOtherClass ? { roles: withHomeroomRole(previous.roles, false) } : {}),
    }, { merge: true });
  }
  appendAuditLog(batch, {
    actor: input.actor,
    action: next ? (previousUid ? "HOMEROOM_CHANGE" : "HOMEROOM_ASSIGN") : "HOMEROOM_CLEAR",
    targetType: "class",
    targetId: input.classRoom.id,
    before: { teacherUid: previousUid ?? null },
    after: { teacherUid: next?.uid ?? null, teacherName: next?.displayName ?? null },
  });
  await batch.commit();
}
