import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AboutPage from './pages/AboutPage'
import PricingPage from './pages/PricingPage'
import ContactPage from './pages/ContactPage'
import RegisterPage from './pages/RegisterPage'
import VerifyPayment from './pages/VerifyPayment'
import PaymentRequired from './pages/PaymentRequired'
import LoginPage from './pages/LoginPage'
import SuperAdminLoginPage from './pages/SuperAdminLoginPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import VerificationRequiredPage from './pages/VerificationRequiredPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DirectorDashboard from './pages/DirectorDashboard'
import PrincipalDashboard from './pages/PrincipalDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentDashboard from './pages/StudentDashboard'
import PrincipalsPage from './pages/dashboard/PrincipalsPage'
import TeachersPage from './pages/dashboard/TeachersPage'
import StudentsPage from './pages/dashboard/StudentsPage'
import ClassesPage from './pages/dashboard/ClassesPage'
import SubjectsPage from './pages/dashboard/SubjectsPage'
import AttendancePage from './pages/dashboard/AttendancePage'
import NoticesPage from './pages/dashboard/NoticesPage'
import PaymentsPage from './pages/dashboard/PaymentsPage'
import SettingsPage from './pages/dashboard/SettingsPage'
import TeacherStudentsPage from './pages/dashboard/TeacherStudentsPage'
import ResultsPage from './pages/dashboard/ResultsPage'
import StudentResultSlipPage from './pages/dashboard/StudentResultSlipPage'
import SupportPage from './pages/dashboard/SupportPage'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import AdminLayout from './layouts/AdminLayout'
import ErrorBoundary from './components/ui/ErrorBoundary'
import BackendHealthBanner from './components/ui/BackendHealthBanner'
import AdminOverviewPage from './pages/admin/AdminOverviewPage'
import AdminSchoolsPage from './pages/admin/AdminSchoolsPage'
import AdminSubscriptionsPage from './pages/admin/AdminSubscriptionsPage'
import AdminSupportPage from './pages/admin/AdminSupportPage'
import AdminActivityPage from './pages/admin/AdminActivityPage'
import AdminSettingsPage from './pages/admin/AdminSettingsPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'

const DashboardIndex = () => {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) return <Navigate to="/login" replace />

  // Redirect to role-specific dashboard home
  switch (user.role) {
    case 'DIRECTOR':
      return <Navigate to="/dashboard/director" replace />
    case 'PRINCIPAL':
      return <Navigate to="/dashboard/principal" replace />
    case 'TEACHER':
      return <Navigate to="/dashboard/teacher" replace />
    case 'STUDENT':
      return <Navigate to="/dashboard/student" replace />
    case 'SUPERADMIN':
      return <Navigate to="/admin" replace />
    default:
      return <Navigate to="/login" replace />
  }
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-brand-100 selection:text-brand-900">
            <BackendHealthBanner />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin/login" element={<SuperAdminLoginPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/verify-email-required" element={<VerificationRequiredPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/payment/verify" element={<VerifyPayment />} />
              <Route path="/payment/required" element={<PaymentRequired />} />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['SUPERADMIN']} redirectTo="/admin/login">
                    <ErrorBoundary>
                      <AdminLayout />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminOverviewPage />} />
                <Route path="schools" element={<AdminSchoolsPage />} />
                <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="support" element={<AdminSupportPage />} />
                <Route path="activity" element={<AdminActivityPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>

              {/* Protected Dashboard Routes (Nested) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['DIRECTOR', 'PRINCIPAL', 'TEACHER', 'STUDENT']}>
                    <ErrorBoundary>
                      <DashboardLayout />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardIndex />} />
                
                {/* Role-Specific Dashboard Homes */}
                <Route path="director" element={<ProtectedRoute allowedRoles={['DIRECTOR']}><DirectorDashboard /></ProtectedRoute>} />
                <Route path="principal" element={<ProtectedRoute allowedRoles={['PRINCIPAL']}><PrincipalDashboard /></ProtectedRoute>} />
                <Route path="teacher" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherDashboard /></ProtectedRoute>} />
                <Route path="student" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />

                {/* Shared Sub-routes */}
                <Route path="principals" element={<ProtectedRoute allowedRoles={['DIRECTOR']}><PrincipalsPage /></ProtectedRoute>} />
                <Route path="teachers" element={<ProtectedRoute allowedRoles={['DIRECTOR', 'PRINCIPAL']}><TeachersPage /></ProtectedRoute>} />
                <Route path="students" element={<ProtectedRoute allowedRoles={['DIRECTOR', 'PRINCIPAL']}><StudentsPage /></ProtectedRoute>} />
                <Route path="classes" element={<ProtectedRoute allowedRoles={['DIRECTOR', 'PRINCIPAL']}><ClassesPage /></ProtectedRoute>} />
                <Route path="subjects" element={<ProtectedRoute allowedRoles={['DIRECTOR', 'PRINCIPAL']}><SubjectsPage /></ProtectedRoute>} />
                <Route path="attendance" element={<ProtectedRoute allowedRoles={['PRINCIPAL', 'TEACHER']}><AttendancePage /></ProtectedRoute>} />
                <Route path="results" element={<ProtectedRoute allowedRoles={['TEACHER']}><ResultsPage /></ProtectedRoute>} />
                <Route path="result-slip" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentResultSlipPage /></ProtectedRoute>} />
                <Route path="notices" element={<ProtectedRoute allowedRoles={['DIRECTOR', 'PRINCIPAL', 'TEACHER']}><NoticesPage /></ProtectedRoute>} />
                <Route path="payments" element={<ProtectedRoute allowedRoles={['DIRECTOR']}><PaymentsPage /></ProtectedRoute>} />
                <Route path="settings" element={<ProtectedRoute allowedRoles={['DIRECTOR', 'PRINCIPAL', 'TEACHER']}><SettingsPage /></ProtectedRoute>} />
                <Route path="support" element={<ProtectedRoute allowedRoles={['DIRECTOR', 'PRINCIPAL', 'TEACHER', 'STUDENT']}><SupportPage /></ProtectedRoute>} />
                <Route path="my-students" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherStudentsPage /></ProtectedRoute>} />

                {/* Fallback for sub-routes */}
                <Route path="*" element={<DashboardIndex />} />
              </Route>
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
