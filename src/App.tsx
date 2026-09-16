import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuditRoute, GradeAdminRoute, OwnerRoute } from "./components/RoleRoute";
import { LoginPage } from "./pages/LoginPage";
import { ScopeProvider } from "./scope/ScopeProvider";

const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const AuditPage = lazy(() => import("./pages/AuditPage").then((module) => ({ default: module.AuditPage })));
const AttendancePage = lazy(() => import("./pages/AttendancePage").then((module) => ({ default: module.AttendancePage })));
const ClassesPage = lazy(() => import("./pages/ClassesPage").then((module) => ({ default: module.ClassesPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const DutySchedulePage = lazy(() => import("./pages/DutySchedulePage").then((module) => ({ default: module.DutySchedulePage })));
const HistoryPage = lazy(() => import("./pages/HistoryPage").then((module) => ({ default: module.HistoryPage })));
const PeriodsPage = lazy(() => import("./pages/PeriodsPage").then((module) => ({ default: module.PeriodsPage })));
const StatsPage = lazy(() => import("./pages/StatsPage").then((module) => ({ default: module.StatsPage })));
const StudentsPage = lazy(() => import("./pages/StudentsPage").then((module) => ({ default: module.StudentsPage })));
const SelfStudyGroupsPage = lazy(() => import("./pages/SelfStudyGroupsPage").then((module) => ({ default: module.SelfStudyGroupsPage })));
const SupervisionPage = lazy(() => import("./pages/SupervisionPage").then((module) => ({ default: module.SupervisionPage })));
const SelfStudyPermissionsPage = lazy(() => import("./pages/SelfStudyPermissionsPage").then((module) => ({ default: module.SelfStudyPermissionsPage })));
const SelfStudyAttendancePage = lazy(() => import("./pages/SelfStudyAttendancePage").then((module) => ({ default: module.SelfStudyAttendancePage })));
const SelfStudyHistoryPage = lazy(() => import("./pages/SelfStudyHistoryPage").then((module) => ({ default: module.SelfStudyHistoryPage })));
const SelfStudyStatisticsPage = lazy(() => import("./pages/SelfStudyStatisticsPage").then((module) => ({ default: module.SelfStudyStatisticsPage })));
const SelfStudyExceptionsPage = lazy(() => import("./pages/SelfStudyExceptionsPage").then((module) => ({ default: module.SelfStudyExceptionsPage })));
const OperationsPage = lazy(() => import("./pages/OperationsPage").then((module) => ({ default: module.OperationsPage })));
const AcademicYearSetupPage = lazy(() => import("./pages/AcademicYearSetupPage").then((module) => ({ default: module.AcademicYearSetupPage })));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScopeProvider>
        <Suspense fallback={<div className="card narrow">{"\uBD88\uB7EC\uC624\uB294 \uC911..."}</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/duty" element={<DutySchedulePage />} />
            <Route path="/students" element={<GradeAdminRoute><StudentsPage /></GradeAdminRoute>} />
            <Route path="/classes" element={<GradeAdminRoute><ClassesPage /></GradeAdminRoute>} />
            <Route path="/self-study-groups" element={<GradeAdminRoute><SelfStudyGroupsPage /></GradeAdminRoute>} />
            <Route path="/supervision" element={<GradeAdminRoute><SupervisionPage /></GradeAdminRoute>} />
            <Route path="/self-study-permissions" element={<SelfStudyPermissionsPage />} />
            <Route path="/self-study-attendance" element={<SelfStudyAttendancePage />} />
            <Route path="/self-study-history" element={<SelfStudyHistoryPage />} />
            <Route path="/self-study-statistics" element={<SelfStudyStatisticsPage />} />
            <Route path="/self-study-exceptions" element={<SelfStudyExceptionsPage />} />
            <Route path="/periods" element={<GradeAdminRoute><PeriodsPage /></GradeAdminRoute>} />
            <Route path="/stats" element={<GradeAdminRoute><StatsPage /></GradeAdminRoute>} />
            <Route path="/admin" element={<OwnerRoute><AdminPage /></OwnerRoute>} />
            <Route path="/admin/operations" element={<OwnerRoute><OperationsPage /></OwnerRoute>} />
            <Route path="/admin/academic-year-setup" element={<OwnerRoute><AcademicYearSetupPage /></OwnerRoute>} />
            <Route path="/audit" element={<AuditRoute><AuditPage /></AuditRoute>} />
          </Route>
        </Routes>
        </Suspense>
        </ScopeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
