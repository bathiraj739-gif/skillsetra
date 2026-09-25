import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { assessmentService } from '../../services/assessmentService'
import { questionService } from '../../services/questionService'
import type { Assessment, AssessmentStatus, Question } from '../../types'
import {
  FileCheck,
  Plus,
  Clock,
  UserCheck,
  Brain,
  MessageSquare,
  Edit2,
  X,
  Save,
  AlertCircle,
  HelpCircle,
  CheckSquare,
  Square,
  Search,
  Trash2,
  CheckCircle2,
} from 'lucide-react'

/* ====================================================================
   CREATE & EDIT ASSESSMENT MODAL WITH DIRECT QUESTION BANK SELECTION
   ==================================================================== */
interface CreateEditAssessmentModalProps {
  editingAssessment: Assessment | null
  onClose: () => void
  onSaveSuccess: () => void
}

const CreateEditAssessmentModal: React.FC<CreateEditAssessmentModalProps> = ({
  editingAssessment,
  onClose,
  onSaveSuccess,
}) => {
  const [formData, setFormData] = useState({
    title: editingAssessment?.title || '',
    description: editingAssessment?.description || '',
    duration_minutes: editingAssessment?.duration_minutes || 30,
    passing_percentage: editingAssessment?.passing_percentage || 50,
    status: (editingAssessment?.status || 'published') as AssessmentStatus,
  })

  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set())

  const [loadingQuestions, setLoadingQuestions] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [sectionFilter, setSectionFilter] = useState<'all' | 'aptitude' | 'verbal'>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')

  useEffect(() => {
    loadQuestionsAndCustomisation()
  }, [editingAssessment])

  const loadQuestionsAndCustomisation = async () => {
    setLoadingQuestions(true)
    setError(null)
    try {
      const qData = await questionService.getQuestions()
      setAllQuestions(qData || [])

      if (editingAssessment) {
        const configuredQs = await assessmentService.getAssessmentQuestions(editingAssessment.id)
        const configuredIdSet = new Set((configuredQs || []).map((q) => q.id))
        setSelectedQuestionIds(configuredIdSet)
      }
    } catch (err: any) {
      console.error('Failed to load Question Bank:', err)
      setError('Unable to load questions from Question Bank.')
    } finally {
      setLoadingQuestions(false)
    }
  }

  const toggleQuestionSelection = (id: string) => {
    const next = new Set(selectedQuestionIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedQuestionIds(next)
  }

  const handleRemoveSelectedQuestion = (id: string) => {
    const next = new Set(selectedQuestionIds)
    next.delete(id)
    setSelectedQuestionIds(next)
  }

  const filteredQuestions = allQuestions.filter((q) => {
    if (!q.is_active) return false
    if (sectionFilter !== 'all' && q.section !== sectionFilter) return false
    if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false
    if (search.trim()) {
      const s = search.toLowerCase()
      const matchText = q.question_text.toLowerCase().includes(s)
      const matchTopic = q.topic ? q.topic.toLowerCase().includes(s) : false
      if (!matchText && !matchTopic) return false
    }
    return true
  })

  const selectedQuestionsList = allQuestions.filter((q) => selectedQuestionIds.has(q.id))
  const aptitudeSelectedCount = selectedQuestionsList.filter((q) => q.section === 'aptitude').length
  const verbalSelectedCount = selectedQuestionsList.filter((q) => q.section === 'verbal').length

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedQuestionIds)
    filteredQuestions.forEach((q) => next.add(q.id))
    setSelectedQuestionIds(next)
  }

  const handleDeselectAllFiltered = () => {
    const next = new Set(selectedQuestionIds)
    filteredQuestions.forEach((q) => next.delete(q.id))
    setSelectedQuestionIds(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      alert('Please enter assessment title.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const selectedArr = Array.from(selectedQuestionIds)
      await assessmentService.saveAssessmentWithQuestions(
        {
          id: editingAssessment?.id,
          ...formData,
        },
        selectedArr
      )

      onSaveSuccess()
    } catch (err: any) {
      console.error('Failed to save assessment:', err)
      setError(err?.message || 'Error saving assessment to database.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto border border-slate-200">
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {editingAssessment ? 'Edit Assessment' : 'Create New Assessment'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Configure assessment details and select questions directly from the Question Bank.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: ASSESSMENT DETAILS */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 flex items-center justify-between">
              <span>1. Assessment Details</span>
              <span className="text-[10px] text-slate-400 font-normal">Basic configuration</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assessment Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Campus Placement Mock Test 01"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Standard Placement Aptitude & Verbal Evaluation"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Duration (Mins) *
                </label>
                <input
                  type="number"
                  required
                  min={5}
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pass Percentage (%) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={formData.passing_percentage}
                  onChange={(e) => setFormData({ ...formData, passing_percentage: Number(e.target.value) })}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as AssessmentStatus })}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: DIRECT QUESTION BANK SELECTION */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">2. Select Questions from Question Bank</h3>
                <p className="text-xs text-slate-500">
                  Select questions directly from the master Question Bank to include in this assessment.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-1">
                  <Brain className="w-3.5 h-3.5 text-amber-600" /> Aptitude: {aptitudeSelectedCount}
                </span>
                <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-teal-600" /> Verbal: {verbalSelectedCount}
                </span>
                <span className="px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-extrabold">
                  Total: {selectedQuestionIds.size} Qs
                </span>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search question text or topic..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value as any)}
                  className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="all">All Sections</option>
                  <option value="aptitude">Aptitude MCQ</option>
                  <option value="verbal">Verbal MCQ</option>
                </select>

                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value as any)}
                  className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="all">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Showing {filteredQuestions.length} questions from Question Bank</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  Select All Filtered
                </button>
                <span>&bull;</span>
                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  className="text-rose-600 font-bold hover:underline cursor-pointer"
                >
                  Deselect All Filtered
                </button>
              </div>
            </div>

            {/* Question Bank List */}
            {loadingQuestions ? (
              <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-2 text-xs text-slate-500 font-semibold">Loading questions from Question Bank...</p>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-400">
                No active questions match your search or filter.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {filteredQuestions.map((q) => {
                  const isChecked = selectedQuestionIds.has(q.id)
                  return (
                    <div
                      key={q.id}
                      onClick={() => toggleQuestionSelection(q.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 text-xs ${
                        isChecked
                          ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <button type="button" className="mt-0.5 text-indigo-600 flex-shrink-0">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600 fill-indigo-100" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </button>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            q.section === 'aptitude' ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'
                          }`}>
                            {q.section}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase">
                            {q.difficulty}
                          </span>
                          {q.topic && (
                            <span className="text-[10px] font-medium text-slate-400">Topic: {q.topic}</span>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 leading-snug">{q.question_text}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* SECTION 3: SELECTED QUESTIONS ROSTER */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                3. Selected Questions Roster ({selectedQuestionsList.length})
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                Review or remove questions before saving
              </span>
            </div>

            {selectedQuestionsList.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                No questions selected yet. Use the Question Bank list above to select questions.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {selectedQuestionsList.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-slate-300"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="font-extrabold text-slate-400 text-xs min-w-[24px]">#{idx + 1}</span>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            q.section === 'aptitude' ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'
                          }`}>
                            {q.section}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">{q.difficulty}</span>
                        </div>
                        <p className="font-bold text-slate-900 line-clamp-1">{q.question_text}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSelectedQuestion(q.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors flex-shrink-0 cursor-pointer"
                      title="Remove from assessment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Actions Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{selectedQuestionIds.size} question(s) configured</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{editingAssessment ? 'Save Changes' : 'Create Assessment'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ====================================================================
   MAIN ASSESSMENT MANAGEMENT PAGE
   ==================================================================== */
export const AssessmentManagement: React.FC = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [availableAptitude, setAvailableAptitude] = useState(0)
  const [availableVerbal, setAvailableVerbal] = useState(0)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [assData, qData] = await Promise.all([
        assessmentService.getAssessments(),
        questionService.getQuestions(),
      ])

      setAssessments(assData || [])
      setAvailableAptitude(qData?.filter((q) => q.section === 'aptitude' && q.is_active).length || 0)
      setAvailableVerbal(qData?.filter((q) => q.section === 'verbal' && q.is_active).length || 0)
    } catch (err: any) {
      console.error('Failed to load assessments:', err)
      setError('Unable to fetch assessment configurations.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAddModal = () => {
    setEditingAssessment(null)
    setModalOpen(true)
  }

  const handleOpenEditModal = (a: Assessment) => {
    setEditingAssessment(a)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-indigo-600" />
            <span>Assessment Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create placement mock tests with direct Question Bank selection, duration, pass %, and status.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Assessment</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 rounded-2xl text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <Brain className="w-4 h-4 text-amber-400" />
            <span>Master Aptitude Bank: <strong className="text-amber-300 font-bold">{availableAptitude} Qs</strong></span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <MessageSquare className="w-4 h-4 text-teal-400" />
            <span>Master Verbal Bank: <strong className="text-teal-300 font-bold">{availableVerbal} Qs</strong></span>
          </div>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">Select questions directly from the Question Bank during assessment creation.</span>
      </div>

      {loading ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-xs font-semibold text-slate-500">Loading assessments...</p>
        </div>
      ) : assessments.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 space-y-3">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Assessments Created Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create your first placement mock test with direct Question Bank question selection.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create First Assessment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assessments.map((a) => {
            const totalQ = (a.aptitude_count || 0) + (a.verbal_count || 0)

            return (
              <div
                key={a.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold uppercase tracking-wider">
                      Status: {a.status}
                    </span>

                    <button
                      onClick={() => handleOpenEditModal(a)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                      title="Edit assessment"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">{a.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{a.description || 'Standard Placement Evaluation'}</p>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
                      <span className="text-amber-800 block text-[10px] uppercase font-semibold">Aptitude Qs</span>
                      <strong className="text-amber-950 text-base font-extrabold">{a.aptitude_count}</strong>
                    </div>

                    <div className="bg-teal-50/60 p-2.5 rounded-xl border border-teal-100">
                      <span className="text-teal-800 block text-[10px] uppercase font-semibold">Verbal Qs</span>
                      <strong className="text-teal-950 text-base font-extrabold">{a.verbal_count}</strong>
                    </div>

                    <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
                      <span className="text-indigo-800 block text-[10px] uppercase font-semibold">Total Qs</span>
                      <strong className="text-indigo-950 text-base font-extrabold">{totalQ}</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-3 text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" /> {a.duration_minutes} Mins
                    </span>
                    <span>Pass: <strong>{a.passing_percentage}%</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(a)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Assessment
                    </button>
                    <Link
                      to="/admin/assignments"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Assign Test
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* UNIFIED CREATE / EDIT ASSESSMENT MODAL */}
      {modalOpen && (
        <CreateEditAssessmentModal
          editingAssessment={editingAssessment}
          onClose={() => setModalOpen(false)}
          onSaveSuccess={() => {
            setModalOpen(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}
