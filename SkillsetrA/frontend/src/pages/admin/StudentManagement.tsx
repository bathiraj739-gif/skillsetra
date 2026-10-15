import React, { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { studentService } from '../../services/studentService'
import { DEPARTMENTS } from '../../constants/departments'
import type { Profile } from '../../types'
import {
  Users,
  Search,
  HelpCircle,
  AlertCircle,
  UserPlus,
  X,
  CheckCircle2,
  Trash2,
  FileSpreadsheet,
  Download,
  Upload,
  Eye,
  EyeOff,
  Mail,
} from 'lucide-react'

export const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    register_number: '',
    email: '',
    department: DEPARTMENTS[0] as string,
    year: 4,
  })

  // Bulk Excel Import State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [bulkPassword, setBulkPassword] = useState('')
  const [showBulkPassword, setShowBulkPassword] = useState(false)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<{
    totalRows: number
    validCount: number
    invalidCount: number
    alreadyRegisteredCount: number
    rows: Array<{
      rowNumber: number
      status: 'valid' | 'invalid' | 'already_registered'
      errors: string[]
      candidate: any
    }>
  } | null>(null)

  const resetBulkState = () => {
    setSelectedFile(null)
    setBulkPassword('')
    setShowBulkPassword(false)
    setValidating(false)
    setImporting(false)
    setBulkError(null)
    setValidationResult(null)
  }

  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        'Register Number': 'ST2026-001',
        'Full Name': 'Aravind Kumar',
        Email: 'aravind@college.edu',
        Department: 'CSE',
        Year: '4',
        Section: 'A',
        Phone: '9876543210',
      },
      {
        'Register Number': 'ST2026-002',
        'Full Name': 'Bhavya Sharma',
        Email: 'bhavya@college.edu',
        Department: 'ECE',
        Year: '3',
        Section: 'B',
        Phone: '9876543211',
      },
    ]
    const worksheet = XLSX.utils.json_to_sheet(sampleData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates')
    XLSX.writeFile(workbook, 'candidate_registration_template.xlsx')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setValidationResult(null)
      setBulkError(null)
    }
  }

  const handleValidateExcel = async () => {
    if (!selectedFile) {
      setBulkError('Please choose an Excel file first.')
      return
    }
    if (!bulkPassword) {
      setBulkError('Initial password is required for all imported candidates.')
      return
    }
    if (bulkPassword.length < 6) {
      setBulkError('Initial password must be at least 6 characters long.')
      return
    }

    setValidating(true)
    setBulkError(null)

    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

      if (!rawRows || rawRows.length === 0) {
        setBulkError('The selected Excel file is empty.')
        setValidating(false)
        return
      }

      const result = await studentService.bulkValidateCandidates(rawRows)
      setValidationResult(result)
    } catch (err: any) {
      console.error('Validation error:', err)
      setBulkError(err.message || 'Failed to read or validate the Excel file.')
    } finally {
      setValidating(false)
    }
  }

  const handleConfirmBulkRegistration = async () => {
    if (!validationResult || validationResult.validCount === 0) {
      setBulkError('No valid candidates found to register.')
      return
    }
    if (!bulkPassword || bulkPassword.length < 6) {
      setBulkError('Initial password must be at least 6 characters long.')
      return
    }

    const validCandidates = validationResult.rows
      .filter((r) => r.status === 'valid')
      .map((r) => r.candidate)

    setImporting(true)
    setBulkError(null)

    try {
      const response = await studentService.bulkImportCandidates(validCandidates, bulkPassword)
      setSuccessMessage(
        `Bulk Candidate Registration Complete! ${response.registeredCount} new candidate(s) successfully registered.`
      )
      setIsBulkModalOpen(false)
      resetBulkState()
      await loadStudents()
    } catch (err: any) {
      console.error('Bulk import error:', err)
      setBulkError(err.message || 'Failed to import candidates.')
    } finally {
      setImporting(false)
    }
  }

  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await studentService.getAllStudents()
      setStudents(data || [])
    } catch (err: any) {
      console.error('Failed to load students:', err)
      setError('Unable to fetch candidate roster.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    // Form Validations
    if (!formData.name.trim()) {
      setError('Full Name is required.')
      return
    }

    if (!formData.username.trim()) {
      setError('Username is required.')
      return
    }

    if (!formData.password) {
      setError('Password is required.')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match. Please verify password confirmation.')
      return
    }

    if (!formData.register_number.trim()) {
      setError('Register Number is required.')
      return
    }

    setSubmitting(true)

    try {
      const created = await studentService.createStudentProfile({
        name: formData.name.trim(),
        username: formData.username.trim(),
        password: formData.password.trim(),
        register_number: formData.register_number.trim(),
        email: formData.email.trim(),
        department: formData.department,
        year: Number(formData.year),
      })

      setSuccessMessage(
        `Student Account Created Successfully! | Name: ${created.name} | Username: ${created.username} | Register No: ${created.register_number} | Department: ${created.department} | Year: ${created.year}`
      )

      setIsModalOpen(false)
      setFormData({
        name: '',
        username: '',
        password: '',
        confirmPassword: '',
        register_number: '',
        email: '',
        department: DEPARTMENTS[0],
        year: 4,
      })
      await loadStudents()
    } catch (err: any) {
      console.error('Failed to create student profile:', err)
      setError(err.message || 'Failed to create student profile.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete profile for ${name}?`)) return
    try {
      await studentService.deleteStudentProfile(id)
      setSuccessMessage(`Candidate profile for ${name} removed.`)
      await loadStudents()
    } catch (err: any) {
      setError('Failed to delete student profile.')
    }
  }

  const handleSendWelcomeEmail = async (id: string, name: string, email?: string) => {
    if (!email) {
      setError(`Candidate "${name}" does not have an email address registered.`)
      return
    }
    setSendingEmailId(id)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await studentService.sendWelcomeEmail(id)
      setSuccessMessage(res.message || `Welcome email sent successfully to ${email}`)
    } catch (err: any) {
      setError(err.message || `Failed to send welcome email to ${email}`)
    } finally {
      setSendingEmailId(null)
    }
  }

  const filteredStudents = students.filter((s) => {
    if (!s) return false
    const searchTrim = (search || '').trim().toLowerCase()
    const nameStr = (s.name || s.username || s.email?.split('@')[0] || 'Candidate').toLowerCase()
    const usernameStr = (s.username || '').toLowerCase()
    const emailStr = (s.email || '').toLowerCase()
    const regStr = (s.register_number || (s as any).registerNumber || '').toLowerCase()

    const matchSearch =
      !searchTrim ||
      nameStr.includes(searchTrim) ||
      usernameStr.includes(searchTrim) ||
      emailStr.includes(searchTrim) ||
      regStr.includes(searchTrim)

    const matchDept = deptFilter === 'all' || s.department === deptFilter
    const matchYear = yearFilter === 'all' || String(s.year || 1) === yearFilter

    return matchSearch && matchDept && matchYear
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <span>Student & Candidate Roster</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered placement candidates eligible for Aptitude & Verbal online assessments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
            Candidates: {filteredStudents.length}
          </span>
          <button
            onClick={() => {
              setError(null)
              setIsModalOpen(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Student Profile</span>
          </button>
          <button
            onClick={() => {
              setError(null)
              resetBulkState()
              setIsBulkModalOpen(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Bulk Excel Import</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username, register no..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
        >
          <option value="all">All Departments</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
        >
          <option value="all">All Years</option>
          <option value="1">1st Year</option>
          <option value="2">2nd Year</option>
          <option value="3">3rd Year</option>
          <option value="4">4th Year</option>
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-xs font-semibold text-slate-500">Loading candidate roster...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 space-y-3">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Candidates Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No student accounts matching your filter parameters.
          </p>
          <button
            onClick={() => {
              setError(null)
              setIsModalOpen(true)
            }}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create First Student Profile</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Candidate Name</th>
                  <th className="py-4 px-4">Username</th>
                  <th className="py-4 px-4">Register Number</th>
                  <th className="py-4 px-4">Department</th>
                  <th className="py-4 px-4 text-center">Year</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                        {(s.name || s.username || 'Student').charAt(0).toUpperCase()}
                      </div>
                      <span>{s.name || 'Placement Candidate'}</span>
                    </td>

                    <td className="py-4 px-4 font-mono font-bold text-indigo-700">
                      {s.username || s.email?.split('@')[0] || 'N/A'}
                    </td>

                    <td className="py-4 px-4 font-mono font-semibold text-slate-700">
                      {s.register_number || 'N/A'}
                    </td>

                    <td className="py-4 px-4 text-slate-600 font-bold">
                      {s.department || 'CSE'}
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px]">
                        Year {s.year || 1}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleSendWelcomeEmail(s.id, s.name, s.email)}
                        disabled={!s.email || sendingEmailId === s.id}
                        className={`p-1.5 rounded-lg transition-colors ${
                          s.email
                            ? 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50'
                            : 'text-slate-300 cursor-not-allowed opacity-50'
                        }`}
                        title={s.email ? `Send welcome email to ${s.email}` : 'No email registered'}
                      >
                        {sendingEmailId === s.id ? (
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(s.id, s.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete candidate profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Dialog for Student Profile Creation */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Create Student Profile</h3>
                  <p className="text-xs text-slate-500">Add student account credentials</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Bathi Raj"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })}
                  placeholder="e.g. bathi001"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
                <p className="text-[10px] text-slate-500 mt-1">Student will use this username to log in.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Register Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.register_number}
                    onChange={(e) => setFormData({ ...formData, register_number: e.target.value.toUpperCase() })}
                    placeholder="e.g. ST2026-001"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Academic Year
                  </label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white font-semibold text-slate-800"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. bathi@college.edu (optional)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span>Create Student Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Excel Import Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Bulk Excel Candidate Registration</h3>
                  <p className="text-xs text-slate-500">Upload Excel spreadsheet to register multiple candidates at once</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsBulkModalOpen(false)
                  resetBulkState()
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bulkError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{bulkError}</span>
                </div>
                <button onClick={() => setBulkError(null)} className="text-rose-700 hover:text-rose-900">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="space-y-4">
              {/* Step 1: File Selection & Sample Download */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    1. Choose Excel File (.xlsx, .xls) *
                  </label>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-indigo-50/30 space-y-2 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                      Need a sample template?
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Download the official Excel template pre-formatted with all standard fields.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer w-fit"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel Template</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Common Initial Password */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Common Initial Password *
                </label>
                <div className="relative max-w-md">
                  <input
                    type={showBulkPassword ? 'text' : 'password'}
                    required
                    value={bulkPassword}
                    onChange={(e) => setBulkPassword(e.target.value)}
                    placeholder="Enter initial password for all imported students"
                    className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBulkPassword(!showBulkPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showBulkPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  This initial password will be securely hashed and assigned to all new candidates in this batch.
                </p>
              </div>

              {/* Action Button: Validate Excel */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleValidateExcel}
                  disabled={validating || !selectedFile || !bulkPassword}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {validating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Validating Excel Data...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Validate Excel</span>
                    </>
                  )}
                </button>
              </div>

              {/* Step 3: Validation Preview */}
              {validationResult && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Validation Preview
                  </h4>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 text-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Total Rows</p>
                      <p className="text-lg font-extrabold text-slate-800">{validationResult.totalRows}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Valid</p>
                      <p className="text-lg font-extrabold text-emerald-700">{validationResult.validCount}</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                      <p className="text-[10px] font-bold text-amber-600 uppercase">Already Registered</p>
                      <p className="text-lg font-extrabold text-amber-700">{validationResult.alreadyRegisteredCount}</p>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-center">
                      <p className="text-[10px] font-bold text-rose-600 uppercase">Invalid</p>
                      <p className="text-lg font-extrabold text-rose-700">{validationResult.invalidCount}</p>
                    </div>
                  </div>

                  {/* Candidate Status Rows Table */}
                  <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200 text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Row #</th>
                          <th className="py-2.5 px-3">Reg Number</th>
                          <th className="py-2.5 px-3">Full Name</th>
                          <th className="py-2.5 px-3">Email</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validationResult.rows.map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-500">{row.rowNumber}</td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">{row.candidate.register_number || '-'}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{row.candidate.full_name || '-'}</td>
                            <td className="py-2 px-3 text-slate-600">{row.candidate.email || '-'}</td>
                            <td className="py-2 px-3 text-slate-600">{row.candidate.department || '-'}</td>
                            <td className="py-2 px-3">
                              {row.status === 'valid' && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  Valid
                                </span>
                              )}
                              {row.status === 'already_registered' && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  Already Registered
                                </span>
                              )}
                              {row.status === 'invalid' && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                                  Invalid
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-[11px]">
                              {row.errors.length > 0 ? (
                                <span className="text-rose-600 font-medium">{row.errors.join('; ')}</span>
                              ) : (
                                <span className="text-emerald-600 font-medium">Ready for import</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsBulkModalOpen(false)
                  resetBulkState()
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkRegistration}
                disabled={importing || !validationResult || validationResult.validCount === 0}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Registering Candidates...</span>
                  </>
                ) : (
                  <span>Confirm Registration ({validationResult?.validCount || 0})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
