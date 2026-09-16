import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { parseStudentWorkbook, type StudentImportSummary } from "../lib/excel";
import { listClasses } from "../services/classes";
import { addStudent, commitStudentImport, listStudents } from "../services/masterData";
import type { ClassRoom, Student } from "../types/domain";

export function StudentsPage() {
  const { appUser } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("2-1");
  const [studentNo, setStudentNo] = useState(1);
  const [preview, setPreview] = useState<StudentImportSummary | null>(null);
  const [importError, setImportError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [nextStudents, nextClasses] = await Promise.all([listStudents(), listClasses()]);
    setStudents(nextStudents);
    setClasses(nextClasses);
  }

  useEffect(() => { void refresh(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!appUser) return;
    await addStudent({ name, classId, studentNo, active: true }, { uid: appUser.uid, name: appUser.displayName });
    setName("");
    await refresh();
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      setPreview(await parseStudentWorkbook(file, classes, students));
      setImportError("");
    } catch (error) {
      setPreview(null);
      setImportError(error instanceof Error ? error.message : "The workbook could not be read.");
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!preview || !appUser || preview.errorCount || preview.conflictCount) return;
    setBusy(true);
    try {
      await commitStudentImport(preview.rows, { uid: appUser.uid, name: appUser.displayName });
      setPreview(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-header"><div><div className="eyebrow">{"\uD559\uB144\uBD80"}</div><h2>{"\uD559\uC0DD \uBA85\uBD80 \uAD00\uB9AC"}</h2></div></header>
      <div className="grid two">
        <form className="card" onSubmit={submit}>
          <h3>{"\uD559\uC0DD \uCD94\uAC00"}</h3>
          <label>{"\uBC18"}<input value={classId} onChange={(e) => setClassId(e.target.value)} /></label>
          <label>{"\uBC88\uD638"}<input type="number" min={1} value={studentNo} onChange={(e) => setStudentNo(Number(e.target.value))} /></label>
          <label>{"\uC774\uB984"}<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <button className="primary">{"\uCD94\uAC00"}</button>
        </form>
        <section className="card">
          <h3>{"\uD559\uC0DD \uBA85\uBD80 \uAC00\uC838\uC624\uAE30"}</h3>
          <label className="file-drop">
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])} />
            <strong>{busy ? "\uBD84\uC11D \uC911..." : "XLSX \uBA85\uBD80 \uD30C\uC77C \uC120\uD0DD"}</strong>
            <span>{"\uD544\uC218 \uC5F4: \uD559\uB144, \uBC18, \uBC88\uD638, \uD559\uC0DD \uC774\uB984"}</span>
          </label>
          {importError && <p className="text-danger">{importError}</p>}
        </section>
      </div>
      {preview && (
        <section className="card import-card">
          <div className="section-title-row"><h3>{"\uBA85\uBD80 \uBBF8\uB9AC\uBCF4\uAE30"}</h3><span className={preview.errorCount || preview.conflictCount ? "text-danger" : "text-success"}>{preview.errorCount || preview.conflictCount ? "\uC624\uB958\uB97C \uD574\uACB0\uD55C \uD6C4 \uC801\uC6A9\uD558\uC138\uC694" : "\uC801\uC6A9 \uAC00\uB2A5"}</span></div>
          <div className="duty-readout"><strong>New {preview.newCount}</strong><strong>Update {preview.updateCount}</strong><strong>Unchanged {preview.unchangedCount}</strong><strong>Conflicts {preview.conflictCount}</strong><strong>Errors {preview.errorCount}</strong></div>
          <div className="table-wrap"><table><thead><tr><th>{"\uD589"}</th><th>{"\uBC18"}</th><th>{"\uBC88\uD638"}</th><th>{"\uC774\uB984"}</th><th>{"\uACB0\uACFC"}</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.rowNo}><td>{row.rowNo}</td><td>{row.classId}</td><td>{row.studentNo}</td><td>{row.name}</td><td className={row.error ? "text-danger" : "text-success"}>{row.error ?? row.change}</td></tr>)}</tbody></table></div>
          <div className="action-row"><button className="small" onClick={() => setPreview(null)}>{"\uCDE8\uC18C"}</button><button className="primary" disabled={busy || preview.errorCount > 0 || preview.conflictCount > 0} onClick={() => void commitImport()}>{"\uD655\uC778 \uD6C4 \uC801\uC6A9"}</button></div>
        </section>
      )}
      <section className="card">
        <h3>{"\uC804\uCCB4 \uD559\uC0DD"} {students.length}</h3>
        <div className="table-wrap"><table><thead><tr><th>{"\uBC18"}</th><th>{"\uBC88\uD638"}</th><th>{"\uC774\uB984"}</th><th>{"\uC0C1\uD0DC"}</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td>{student.classId}</td><td>{student.studentNo}</td><td>{student.name}</td><td>{student.active ? "\uD65C\uC131" : "\uBE44\uD65C\uC131"}</td></tr>)}</tbody></table></div>
      </section>
    </>
  );
}
