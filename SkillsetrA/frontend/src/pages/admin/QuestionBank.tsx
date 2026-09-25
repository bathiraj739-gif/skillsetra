import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { questionService } from '../../services/questionService'
import type { Question, QuestionOption, QuestionSection, QuestionDifficulty } from '../../types'
import {
  HelpCircle,
  Plus,
  Search,
  Brain,
  MessageSquare,
  Edit2,
  Trash2,
  X,
  Save,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { QuestionImportModal } from '../../components/admin/QuestionBank/QuestionImportModal'

export const QuestionBank: React.FC = () => {
  const location = useLocation()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getInitialSection = () => {
    if (location.pathname.includes('/aptitude')) return 'aptitude'
    if (location.pathname.includes('/verbal')) return 'verbal'
    return 'all'
  }

  const [activeSection, setActiveSection] = useState<'all' | QuestionSection>(getInitialSection())
  const [search, setSearch] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)

  const [formData, setFormData] = useState({
    question_text: '',
    section: 'aptitude' as QuestionSection,
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A' as QuestionOption,
    marks: 1,
    difficulty: 'medium' as QuestionDifficulty,
    topic: '',
    is_active: true,
  })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setActiveSection(getInitialSection())
  }, [location.pathname])

  useEffect(() => {
    loadQuestions()
  }, [])

  const loadQuestions = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await questionService.getQuestions()
      setQuestions(data || [])
    } catch (err: any) {
      console.error('Failed to load questions:', err)
      setError('Unable to fetch question bank.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAddModal = (section: QuestionSection = 'aptitude') => {
    setEditingQuestion(null)
    setFormData({
      question_text: '',
      section,
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      marks: 1,
      difficulty: 'medium',
      topic: '',
      is_active: true,
    })
    setModalOpen(true)
  }

  const handleOpenEditModal = (q: Question) => {
    setEditingQuestion(q)
    setFormData({
      question_text: q.question_text,
      section: q.section,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      marks: q.marks,
      difficulty: q.difficulty,
      topic: q.topic || '',
      is_active: q.is_active,
    })
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.question_text || !formData.option_a || !formData.option_b || !formData.option_c || !formData.option_d) {
      alert('Please fill in all question options.')
      return
    }

    setSaving(true)
    try {
      if (editingQuestion) {
        await questionService.updateQuestion(editingQuestion.id, formData)
      } else {
        await questionService.createQuestion(formData)
      }
      setModalOpen(false)
      loadQuestions()
    } catch (err: any) {
      console.error('Failed to save question:', err)
      alert('Error saving question: ' + (err?.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (q: Question) => {
    try {
      await questionService.toggleActive(q.id, q.is_active)
      loadQuestions()
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return
    try {
      await questionService.deleteQuestion(id)
      loadQuestions()
    } catch (err: any) {
      console.error('Failed to delete question:', err)
      alert('Error deleting question: ' + (err?.message || 'Unknown error'))
    }
  }

  const filteredQuestions = questions.filter((q) => {
    const matchSection = activeSection === 'all' || q.section === activeSection
    const matchDifficulty = difficultyFilter === 'all' || q.difficulty === difficultyFilter
    const matchSearch =
      q.question_text.toLowerCase().includes(search.toLowerCase()) ||
      (q.topic && q.topic.toLowerCase().includes(search.toLowerCase()))

    return matchSection && matchDifficulty && matchSearch
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-indigo-600" />
            <span>Question Bank Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Curate proctored Aptitude and Verbal MCQ question items.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap self-start sm:self-auto">
          <button
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Import Questions from Notepad</span>
          </button>

          <button
            onClick={() => handleOpenAddModal(activeSection === 'all' ? 'aptitude' : activeSection)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Question</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveSection('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Questions ({questions.length})
          </button>
          <button
            onClick={() => setActiveSection('aptitude')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSection === 'aptitude' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            Aptitude ({questions.filter((q) => q.section === 'aptitude').length})
          </button>
          <button
            onClick={() => setActiveSection('verbal')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSection === 'verbal' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Verbal ({questions.filter((q) => q.section === 'verbal').length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question text or topic..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-xs font-semibold text-slate-500">Fetching question bank...</p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 space-y-3">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Questions Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No questions available for this section or search filter.
          </p>
          <button
            onClick={() => handleOpenAddModal(activeSection === 'all' ? 'aptitude' : activeSection)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs"
          >
            <Plus className="w-4 h-4" /> Add First Question
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q, index) => (
            <div
              key={q.id}
              className={`bg-white rounded-3xl p-6 border shadow-xs hover:shadow-md transition-all space-y-4 ${
                !q.is_active ? 'opacity-60 border-slate-200 bg-slate-50/50' : 'border-slate-200/80'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-7 h-7 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                    {index + 1}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                      q.section === 'aptitude'
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-teal-50 border-teal-200 text-teal-700'
                    }`}
                  >
                    {q.section === 'aptitude' ? 'Aptitude MCQ' : 'Verbal MCQ'}
                  </span>

                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold uppercase">
                    Difficulty: {q.difficulty}
                  </span>

                  {q.topic && (
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold">
                      Topic: {q.topic}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(q)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                      q.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {q.is_active ? 'Active' : 'Inactive'}
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(q)}
                    className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm font-semibold text-slate-900 leading-relaxed">{q.question_text}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(['A', 'B', 'C', 'D'] as QuestionOption[]).map((opt) => {
                  const key = `option_${opt.toLowerCase()}` as keyof Question
                  const val = q[key] as string
                  const isCorrect = q.correct_answer === opt

                  return (
                    <div
                      key={opt}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        isCorrect
                          ? 'bg-emerald-50/80 border-emerald-300 font-semibold text-emerald-950'
                          : 'bg-slate-50 border-slate-200/80 text-slate-700'
                      }`}
                    >
                      <span>
                        <strong className="mr-2 text-slate-500">{opt}.</strong> {val}
                      </span>
                      {isCorrect && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-200/60 px-2 py-0.5 rounded-md">
                          Correct Answer
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingQuestion ? 'Edit Question' : 'Add New Question to Bank'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Section *
                  </label>
                  <select
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value as QuestionSection })}
                    className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="aptitude">Aptitude MCQ</option>
                    <option value="verbal">Verbal MCQ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Difficulty Level *
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as QuestionDifficulty })}
                    className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Question Text *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.question_text}
                  onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                  placeholder="Enter problem statement or sentence..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Option A *</label>
                  <input
                    type="text"
                    required
                    value={formData.option_a}
                    onChange={(e) => setFormData({ ...formData, option_a: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Option B *</label>
                  <input
                    type="text"
                    required
                    value={formData.option_b}
                    onChange={(e) => setFormData({ ...formData, option_b: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Option C *</label>
                  <input
                    type="text"
                    required
                    value={formData.option_c}
                    onChange={(e) => setFormData({ ...formData, option_c: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Option D *</label>
                  <input
                    type="text"
                    required
                    value={formData.option_d}
                    onChange={(e) => setFormData({ ...formData, option_d: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Correct Answer *
                  </label>
                  <select
                    value={formData.correct_answer}
                    onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value as QuestionOption })}
                    className="w-full py-2.5 px-3 bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold rounded-xl text-xs"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Marks
                  </label>
                  <input
                    type="number"
                    value={formData.marks}
                    onChange={(e) => setFormData({ ...formData, marks: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Topic / Sub-area
                  </label>
                  <input
                    type="text"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    placeholder="e.g. Grammar, Speed"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingQuestion ? 'Update Question' : 'Save to Question Bank'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <QuestionImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={loadQuestions}
        existingQuestions={questions}
        initialSection={activeSection}
      />
    </div>
  )
}
