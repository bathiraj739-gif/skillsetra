import React, { useState } from 'react'
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Check,
  RefreshCw,
} from 'lucide-react'
import { aiQuestionService, type GeneratedAiQuestion } from '../../../services/aiQuestionService'
import { questionService } from '../../../services/questionService'
import type { QuestionSection } from '../../../types'

interface AIQuestionGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: () => void
  initialSection?: 'all' | QuestionSection
}

const APTITUDE_TOPICS = [
  'Percentage',
  'Profit and Loss',
  'Ratio and Proportion',
  'Average',
  'Time and Work',
  'Time Speed Distance',
  'Simple Interest',
  'Compound Interest',
  'Number System',
  'Probability',
  'Permutation and Combination',
  'Data Interpretation',
  'Logical Reasoning',
]

const VERBAL_TOPICS = [
  'Tenses',
  'Articles',
  'Prepositions',
  'Synonyms',
  'Antonyms',
  'Sentence Correction',
  'Error Detection',
  'Vocabulary',
  'Active and Passive Voice',
  'Direct and Indirect Speech',
  'Reading Comprehension',
]

export const AIQuestionGeneratorModal: React.FC<AIQuestionGeneratorModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  initialSection,
}) => {
  const defaultCategory = initialSection === 'verbal' ? 'VERBAL' : 'APTITUDE'
  const [category, setCategory] = useState<'APTITUDE' | 'VERBAL'>(defaultCategory)
  const [topic, setTopic] = useState<string>(
    defaultCategory === 'APTITUDE' ? APTITUDE_TOPICS[0] : VERBAL_TOPICS[0]
  )
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM')
  const [count, setCount] = useState<number>(5)
  const [marks, setMarks] = useState<number>(1)

  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedAiQuestion[]>([])
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingData, setEditingData] = useState<GeneratedAiQuestion | null>(null)

  if (!isOpen) return null

  const handleCategoryChange = (newCat: 'APTITUDE' | 'VERBAL') => {
    setCategory(newCat)
    setTopic(newCat === 'APTITUDE' ? APTITUDE_TOPICS[0] : VERBAL_TOPICS[0])
  }

  const handleGenerate = async () => {
    setError(null)
    setSuccessMessage(null)
    setGenerating(true)
    setGeneratedQuestions([])
    setSelectedIndices([])
    setEditingIndex(null)

    try {
      const questions = await aiQuestionService.generateQuestions({
        category,
        topic,
        difficulty,
        count,
        marks,
      })

      setGeneratedQuestions(questions)
      setSelectedIndices(questions.map((_, index) => index))
    } catch (err: any) {
      console.error('Failed to generate AI questions:', err)
      setError(err.message || 'Failed to generate questions. Please check GEMINI_API_KEY.')
    } finally {
      setGenerating(false)
    }
  }

  const handleToggleSelect = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index))
    } else {
      setSelectedIndices([...selectedIndices, index])
    }
  }

  const handleSelectAll = () => {
    if (selectedIndices.length === generatedQuestions.length) {
      setSelectedIndices([])
    } else {
      setSelectedIndices(generatedQuestions.map((_, i) => i))
    }
  }

  const handleRejectQuestion = (index: number) => {
    const updated = generatedQuestions.filter((_, i) => i !== index)
    setGeneratedQuestions(updated)
    setSelectedIndices(selectedIndices.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)))
  }

  const handleStartEdit = (index: number) => {
    setEditingIndex(index)
    setEditingData({ ...generatedQuestions[index] })
  }

  const handleSaveEdit = () => {
    if (editingIndex !== null && editingData) {
      const updated = [...generatedQuestions]
      updated[editingIndex] = editingData
      setGeneratedQuestions(updated)
      setEditingIndex(null)
      setEditingData(null)
    }
  }

  const handleApproveSingle = async (index: number) => {
    setError(null)
    setApproving(true)
    const q = generatedQuestions[index]

    try {
      await questionService.createQuestion({
        question_text: q.questionText,
        option_a: q.optionA,
        option_b: q.optionB,
        option_c: q.optionC,
        option_d: q.optionD,
        correct_answer: q.correctOption,
        section: q.category.toLowerCase() as QuestionSection,
        difficulty: q.difficulty.toLowerCase() as any,
        marks: q.marks,
        is_active: true,
      })

      handleRejectQuestion(index)
      setSuccessMessage('Approved and saved question into Question Bank!')
      onImportSuccess()
    } catch (err: any) {
      console.error('Failed to approve question:', err)
      setError(err.message || 'Failed to save question into database.')
    } finally {
      setApproving(false)
    }
  }

  const handleApproveSelected = async () => {
    if (selectedIndices.length === 0) {
      setError('Please select at least one question to approve.')
      return
    }

    setError(null)
    setApproving(true)
    let approvedCount = 0

    try {
      for (const index of selectedIndices) {
        const q = generatedQuestions[index]
        if (!q) continue
        await questionService.createQuestion({
          question_text: q.questionText,
          option_a: q.optionA,
          option_b: q.optionB,
          option_c: q.optionC,
          option_d: q.optionD,
          correct_answer: q.correctOption,
          section: q.category.toLowerCase() as QuestionSection,
          difficulty: q.difficulty.toLowerCase() as any,
          marks: q.marks,
          is_active: true,
        })
        approvedCount++
      }

      setSuccessMessage(`Successfully approved and inserted ${approvedCount} question(s) into Question Bank!`)
      onImportSuccess()

      const remaining = generatedQuestions.filter((_, i) => !selectedIndices.includes(i))
      setGeneratedQuestions(remaining)
      setSelectedIndices([])
    } catch (err: any) {
      console.error('Failed to approve selected questions:', err)
      setError(err.message || 'Failed to approve questions.')
    } finally {
      setApproving(false)
    }
  }

  const topicsList = category === 'APTITUDE' ? APTITUDE_TOPICS : VERBAL_TOPICS

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">AI Question Generator</h3>
              <p className="text-xs text-slate-500">
                Generate college-placement MCQs using Google Gemini API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Generator Controls Form */}
        <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500"
              >
                <option value="APTITUDE">Aptitude</option>
                <option value="VERBAL">Verbal</option>
              </select>
            </div>

            {/* Topic */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Topic *
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500"
              >
                {topicsList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Difficulty *
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            {/* Number of Questions */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Number of Questions *
              </label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500"
              >
                <option value={1}>1 Question</option>
                <option value={5}>5 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={20}>20 Questions</option>
                <option value={25}>25 Questions</option>
                <option value={50}>50 Questions</option>
              </select>
            </div>

            {/* Marks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Marks Per Question *
              </label>
              <select
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500"
              >
                <option value={1}>1 Mark</option>
                <option value={2}>2 Marks</option>
                <option value={5}>5 Marks</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-200 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating questions with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Questions</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated Preview Section */}
        {generatedQuestions.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>AI Generated Questions Preview</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-extrabold">
                    {generatedQuestions.length} Items
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Review and edit before approving into the master Question Bank.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {selectedIndices.length === generatedQuestions.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </button>
                <button
                  type="button"
                  onClick={handleApproveSelected}
                  disabled={approving || selectedIndices.length === 0}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {approving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Approve Selected ({selectedIndices.length})</span>
                </button>
              </div>
            </div>

            {/* Question Cards List */}
            <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
              {generatedQuestions.map((q, index) => {
                const isSelected = selectedIndices.includes(index)
                const isEditing = editingIndex === index

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-purple-300 bg-purple-50/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(index)}
                        className="mt-1 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-500">
                              #{index + 1}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                              {q.category} • {q.topic}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold uppercase">
                              {q.difficulty}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {!isEditing ? (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(index)}
                                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Edit Question"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                                title="Save Edit"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRejectQuestion(index)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Reject Question"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApproveSingle(index)}
                              disabled={approving}
                              className="ml-2 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs cursor-pointer"
                            >
                              Approve
                            </button>
                          </div>
                        </div>

                        {/* Question Content / Edit mode */}
                        {!isEditing ? (
                          <>
                            <p className="text-xs font-bold text-slate-900 leading-relaxed">
                              {q.questionText}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div
                                className={`p-2.5 rounded-xl border ${
                                  q.correctOption === 'A'
                                    ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="font-bold mr-1.5">A.</span> {q.optionA}
                              </div>
                              <div
                                className={`p-2.5 rounded-xl border ${
                                  q.correctOption === 'B'
                                    ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="font-bold mr-1.5">B.</span> {q.optionB}
                              </div>
                              <div
                                className={`p-2.5 rounded-xl border ${
                                  q.correctOption === 'C'
                                    ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="font-bold mr-1.5">C.</span> {q.optionC}
                              </div>
                              <div
                                className={`p-2.5 rounded-xl border ${
                                  q.correctOption === 'D'
                                    ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="font-bold mr-1.5">D.</span> {q.optionD}
                              </div>
                            </div>

                            {q.explanation && (
                              <div className="p-2.5 bg-purple-50/60 border border-purple-100 rounded-xl text-[11px] text-purple-900">
                                <span className="font-bold text-purple-700">Explanation:</span> {q.explanation}
                              </div>
                            )}
                          </>
                        ) : (
                          /* Edit Form */
                          editingData && (
                            <div className="space-y-3 pt-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                                  Question Text
                                </label>
                                <textarea
                                  rows={2}
                                  value={editingData.questionText}
                                  onChange={(e) =>
                                    setEditingData({ ...editingData, questionText: e.target.value })
                                  }
                                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs"
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                                    Option A
                                  </label>
                                  <input
                                    type="text"
                                    value={editingData.optionA}
                                    onChange={(e) =>
                                      setEditingData({ ...editingData, optionA: e.target.value })
                                    }
                                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                                    Option B
                                  </label>
                                  <input
                                    type="text"
                                    value={editingData.optionB}
                                    onChange={(e) =>
                                      setEditingData({ ...editingData, optionB: e.target.value })
                                    }
                                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                                    Option C
                                  </label>
                                  <input
                                    type="text"
                                    value={editingData.optionC}
                                    onChange={(e) =>
                                      setEditingData({ ...editingData, optionC: e.target.value })
                                    }
                                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                                    Option D
                                  </label>
                                  <input
                                    type="text"
                                    value={editingData.optionD}
                                    onChange={(e) =>
                                      setEditingData({ ...editingData, optionD: e.target.value })
                                    }
                                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                                  Correct Option
                                </label>
                                <select
                                  value={editingData.correctOption}
                                  onChange={(e) =>
                                    setEditingData({
                                      ...editingData,
                                      correctOption: e.target.value as any,
                                    })
                                  }
                                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-emerald-800"
                                >
                                  <option value="A">Option A</option>
                                  <option value="B">Option B</option>
                                  <option value="C">Option C</option>
                                  <option value="D">Option D</option>
                                </select>
                              </div>

                              <div className="flex justify-end gap-2 pt-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingIndex(null)}
                                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold text-slate-600"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSaveEdit}
                                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 flex items-center justify-end border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
