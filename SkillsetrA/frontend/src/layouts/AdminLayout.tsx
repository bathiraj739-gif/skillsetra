import React, { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/common/Logo'
import {
  LayoutDashboard,
  Users,
  HelpCircle,
  FileCheck,
  UserCheck,
  Radio,
  BarChart2,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Brain,
  MessageSquare,
} from 'lucide-react'

export const AdminLayout: React.FC = () => {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [questionSubmenuOpen, setQuestionSubmenuOpen] = useState(true)

  const handleLogout = async () => {
    await signOut()
    navigate('/admin/login')
  }

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Mobile Topbar */}
      <div className="md:hidden bg-slate-900 text-white flex items-center justify-between px-4 py-3 sticky top-0 z-50">
        <Logo size="sm" lightText subtitle="Admin Portal" />
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Admin Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Sidebar Brand */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
          <Logo size="md" lightText subtitle="TPO / Admin Portal" />
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <Link
            to="/admin/dashboard"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname === '/admin/dashboard'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>

          <Link
            to="/admin/students"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/admin/students')
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Students</span>
          </Link>

          {/* Question Bank Accordion */}
          <div>
            <button
              onClick={() => setQuestionSubmenuOpen(!questionSubmenuOpen)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive('/admin/questions')
                  ? 'bg-slate-800 text-indigo-300 font-semibold'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                <span>Question Bank</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${questionSubmenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {questionSubmenuOpen && (
              <div className="pl-9 pr-2 py-1 space-y-1">
                <Link
                  to="/admin/questions"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium ${
                    location.pathname === '/admin/questions'
                      ? 'text-white bg-indigo-600/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Questions
                </Link>
                <Link
                  to="/admin/questions/aptitude"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium ${
                    location.pathname === '/admin/questions/aptitude'
                      ? 'text-white bg-indigo-600/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5 text-amber-400" />
                  Aptitude MCQ
                </Link>
                <Link
                  to="/admin/questions/verbal"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium ${
                    location.pathname === '/admin/questions/verbal'
                      ? 'text-white bg-indigo-600/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
                  Verbal MCQ
                </Link>
              </div>
            )}
          </div>

          <Link
            to="/admin/assessments"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/admin/assessments')
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Assessments</span>
          </Link>

          <Link
            to="/admin/assignments"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/admin/assignments')
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Assignments</span>
          </Link>

          <Link
            to="/admin/live-monitoring"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/admin/live-monitoring')
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Live Monitoring</span>
          </Link>

          <Link
            to="/admin/results"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/admin/results')
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Results</span>
          </Link>

          <Link
            to="/admin/reports"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/admin/reports')
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Reports</span>
          </Link>
        </nav>

        {/* Sidebar Footer / Logout */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-indigo-400 font-bold flex items-center justify-center text-xs flex-shrink-0">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{profile?.name || 'Admin User'}</p>
              <p className="text-[10px] text-slate-400 truncate">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Admin Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
