import { assertDutyDay } from "../domain/schedule";
import { assertOperationalSelfStudyDate } from "./selfStudyExceptions";

export async function validateDutyAssignmentDate(date: string): Promise<void> {
  assertDutyDay(date);
  await assertOperationalSelfStudyDate(date);
}
