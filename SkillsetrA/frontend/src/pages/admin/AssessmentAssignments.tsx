import React, { useEffect, useState } from 'react'
import { assessmentService } from '../../services/assessmentService'
import { studentService } from '../../services/studentService'
import { DEPARTMENTS } from '../../constants/departments'
import type { Assessment, Profile, AssessmentAssignment } from '../../types'
import { UserCheck, CheckCircle2, AlertCircle, Send, CheckSquare, Square } from 'lucide-react'

export const AssessmentAssignments: React.FC = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [students, setStudents] = useState<Profile[]>([])
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('')

  const [assignMode, setAssignMode] = useState<'all' | 'dept' | 'individual'>('all')
  const [selectedDept, setSelectedDept] = useState<string>(DEPARTMENTS[3]) // CSE by default
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])

  const [assignedList, setAssignedList] = useState<(AssessmentAssignment & { student: Profile })[]>([])

  const [assigning, setAssigning] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadInitial()
  }, [])

  useEffect(() => {
    if (selectedAssessmentId) {
      loadAssignments(selectedAssessmentId)
    }
  }, [selectedAssessmentId])

  const loadInitial = async () => {
    try {
      const [assData, stData] = await Promise.all([
        assessmentService.getAssessments(),
        studentService.getAllStudents(),
      ])

      setAssessments(assData || [])
      setStudents(stData || [])

      if (assData && assData.length > 0) {
        setSelectedAssessmentId(assData[0].id)
      }
    } catch (err: any) {
      console.error('Failed to load assignments page:', err)
    }
  }

  const loadAssignments = async (assId: string) => {
    try {
      const data = await assessmentService.getAssignedStudents(assId)
      setAssignedList(data || [])
    } catch (err) {
      console.error('Failed to load assigned students:', err)
    }
  }

  const handleToggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((s) => s !== id))
    } else {
      setSelectedStudentIds([...selectedStudentIds, id])
    }
  }

  const handleSelectAllStudents = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([])
    } else {
      setSelectedStudentIds(students.map((s) => s.id))
    }
  }

  const handleExecuteAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssessmentId) {
      alert('Please select an assessment.')
      return
    }

    setAssigning(true)
    setMessage(null)

    try {
      if (assignMode === 'all') {
        await assessmentService.assignToAllStudents(selectedAssessmentId)
        setMessage({ type: 'success', text: 'Assessment assigned to all registered candidates successfully!' })
      } else if (assignMode === 'dept') {
        await assessmentService.assignToDepartment(selectedAssessmentId, selectedDept)
        setMessage({ type: 'success', text: `Assessment assigned to ${selectedDept} department candidates!` })
      } else if (assignMode === 'individual') {
        if (selectedStudentIds.length === 0) {
          alert('Please select at least one student.')
          setAssigning(false)
          return
        }
        await assessmentService.assignAssessmentToStudents(selectedAssessmentId, selectedStudentIds)
        setMessage({ type: 'success', text: `Assessment assigned to ${selectedStudentIds.length} selected candidates!` })
      }

      loadAssignments(selectedAssessmentId)
    } catch (err: any) {
      console.error('Assignment error:', err)
      setMessage({ type: 'error', text: err?.message || 'Failed to assign assessment.' })
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-indigo-600" />
          <span>Assessment Assignments</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Assign published Aptitude and Verbal tests to all candidates, specific departments, or individual students.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          Configure Assignment Target
        </h2>

        <form onSubmit={handleExecuteAssign} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select Assessment *
            </label>
            <select
              value={selectedAssessmentId}
              onChange={(e) => setSelectedAssessmentId(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.duration_minutes} Mins | Apt: {a.aptitude_count} Qs, Ver: {a.verbal_count} Qs)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Assignment Strategy
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setAssignMode('all')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  assignMode === 'all'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <span className="text-xs uppercase font-extrabold block text-indigo-600">All Students</span>
                <span className="text-[11px] text-slate-500 font-normal">Assign to all {students.length} registered candidates</span>
              </button>

              <button
                type="button"
                onClick={() => setAssignMode('dept')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  assignMode === 'dept'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <span className="text-xs uppercase font-extrabold block text-indigo-600">By Department</span>
                <span className="text-[11px] text-slate-500 font-normal">Target specific branch candidates</span>
              </button>

              <button
                type="button"
                onClick={() => setAssignMode('individual')}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  assignMode === 'individual'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <span className="text-xs uppercase font-extrabold block text-indigo-600">Custom Selection</span>
                <span className="text-[11px] text-slate-500 font-normal">Select individual candidates from roster</span>
              </button>
            </div>
          </div>

          {assignMode === 'dept' && (
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Target Department
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {assignMode === 'individual' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase">
                  Selected Candidates ({selectedStudentIds.length} of {students.length})
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllStudents}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  {selectedStudentIds.length === students.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                {students.map((s) => {
                  const isChecked = selectedStudentIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleToggleStudent(s.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                        isChecked
                          ? 'bg-indigo-600 text-white font-bold border-indigo-600'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="truncate">
                        <p className="truncate">{s.name}</p>
                        <p className={`text-[10px] truncate ${isChecked ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {s.register_number} | {s.department}
                        </p>
                      </div>
                      {isChecked ? <CheckSquare className="w-4 h-4 flex-shrink-0" /> : <Square className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={assigning}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              {assigning ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Execute Assessment Assignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Assigned Roster for Selected Assessment ({assignedList.length})
          </h3>
        </div>

        {assignedList.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No candidates assigned to this assessment yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Candidate Name</th>
                  <th className="py-3 px-4">Register Number</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Assigned Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {assignedList.map((item) => {
                  const candidateName =
                    item.student?.name ||
                    item.student?.full_name ||
                    (item as any)?.full_name ||
                    (item as any)?.student_name ||
                    (item as any)?.candidate_name ||
                    'Candidate'
                  const regNo = item.student?.register_number || (item as any)?.register_number || 'N/A'
                  const dept = item.student?.department || (item as any)?.department || '—'

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-6 font-bold text-slate-900">{candidateName}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{regNo}</td>
                      <td className="py-3 px-4 text-slate-600">{dept}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right text-slate-400">
                        {new Date(item.assigned_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
