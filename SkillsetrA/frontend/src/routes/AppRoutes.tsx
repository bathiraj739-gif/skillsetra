import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Auth Pages
import { StudentLogin } from '../pages/auth/StudentLogin'
import { AdminLogin } from '../pages/auth/AdminLogin'
import { Unauthorized } from '../pages/auth/Unauthorized'

// Protection Wrappers
import { ProtectedRoute } from './ProtectedRoute'
import { RoleProtectedRoute } from './RoleProtectedRoute'

// Layouts
import { StudentLayout } from '../layouts/StudentLayout'
import { AdminLayout } from '../layouts/AdminLayout'

// Student Pages
import { StudentDashboard } from '../pages/student/StudentDashboard'
import { StudentProfile } from '../pages/student/StudentProfile'
import { StudentAssessments } from '../pages/student/StudentAssessments'
import { StudentAssessmentStart } from '../pages/student/StudentAssessmentStart'
import { ExamInterface } from '../pages/student/ExamInterface'
import { StudentResultView } from '../pages/student/StudentResultView'
import { StudentResults } from '../pages/student/StudentResults'

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard'
import { StudentManagement } from '../pages/admin/StudentManagement'
import { QuestionBank } from '../pages/admin/QuestionBank'
import { AssessmentManagement } from '../pages/admin/AssessmentManagement'
import { AssessmentAssignments } from '../pages/admin/AssessmentAssignments'
import { LiveMonitoring } from '../pages/admin/LiveMonitoring'
import { AdminResults } from '../pages/admin/AdminResults'
import { AdminReports } from '../pages/admin/AdminReports'

export const AppRoutes: React.FC = () => {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium text-sm">Loading SkillsetrA Platform...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={user && role === 'student' ? <Navigate to="/student/dashboard" replace /> : <StudentLogin />} />
      <Route path="/student/login" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/admin/login" element={user && role === 'admin' ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Root redirect */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={role === 'admin' ? '/admin/dashboard' : '/student/dashboard'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Student Protected Routes */}
      <Route element={<ProtectedRoute loginPath="/login" />}>
        <Route element={<RoleProtectedRoute allowedRole="student" redirectPath="/login" />}>
          <Route element={<StudentLayout />}>
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<StudentProfile />} />
            <Route path="/student/assessments" element={<StudentAssessments />} />
            <Route path="/student/assessment/:id/instructions" element={<StudentAssessmentStart />} />
            <Route path="/student/result/:id" element={<StudentResultView />} />
            <Route path="/student/results" element={<StudentResults />} />
          </Route>
          {/* Fullscreen Proctored Exam Interface */}
          <Route path="/student/assessment/:id" element={<ExamInterface />} />
        </Route>
      </Route>

      {/* Admin Protected Routes */}
      <Route element={<ProtectedRoute loginPath="/admin/login" />}>
        <Route element={<RoleProtectedRoute allowedRole="admin" redirectPath="/admin/login" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/students" element={<StudentManagement />} />
            <Route path="/admin/questions" element={<QuestionBank />} />
            <Route path="/admin/questions/aptitude" element={<QuestionBank />} />
            <Route path="/admin/questions/verbal" element={<QuestionBank />} />
            <Route path="/admin/assessments" element={<AssessmentManagement />} />
            <Route path="/admin/assignments" element={<AssessmentAssignments />} />
            <Route path="/admin/live-monitoring" element={<LiveMonitoring />} />
            <Route path="/admin/results" element={<AdminResults />} />
            <Route path="/admin/reports" element={<AdminReports />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
