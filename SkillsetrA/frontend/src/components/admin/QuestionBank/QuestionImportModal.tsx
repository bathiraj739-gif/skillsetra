import React, { useState, useRef } from 'react'
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import type { Question, QuestionSection, QuestionDifficulty } from '../../../types'
import { parseQuestionFile, type ParsedQuestion, type ParseResult } from './questionParser'
import { questionService } from '../../../services/questionService'

interface QuestionImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: () => void
  existingQuestions: Question[]
  initialSection: 'all' | QuestionSection
}

type TabFilter = 'all' | 'valid' | 'duplicate' | 'error'

export const QuestionImportModal: React.FC<QuestionImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingQuestions,
  initialSection,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [targetSection, setTargetSection] = useState<QuestionSection>(
    initialSection === 'all' ? 'aptitude' : initialSection
  )
  const [targetDifficulty, setTargetDifficulty] = useState<QuestionDifficulty>('medium')
  const [targetTopic, setTargetTopic] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<TabFilter>('all')

  const [importing, setImporting] = useState(false)
  const [importCompleted, setImportCompleted] = useState(false)
  const [summaryStats, setSummaryStats] = useState<{
    totalFound: number
    importedCount: number
    duplicateCount: number
    errorCount: number
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      processFile(selectedFile)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      processFile(droppedFile)
    }
  }

  const processFile = (inputFile: File) => {
    if (!inputFile.name.endsWith('.txt')) {
      alert('Please upload a plain text (.txt) Notepad file.')
      return
    }

    setFile(inputFile)
    setImportCompleted(false)
    setSummaryStats(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (text) {
        const result = parseQuestionFile(text)

        // Check duplicates against existing questions
        const existingTextsSet = new Set(
          existingQuestions.map((q) => q.question_text.trim().toLowerCase())
        )

        const questionsWithDup = result.questions.map((q) => {
          const isDup = existingTextsSet.has(q.question_text.trim().toLowerCase())
          return {
            ...q,
            isDuplicate: isDup,
          }
        })

        setParseResult({
          ...result,
          questions: questionsWithDup,
        })
      }
    }
    reader.readAsText(inputFile)
  }

  const handleReset = () => {
    setFile(null)
    setParseResult(null)
    setImportCompleted(false)
    setSummaryStats(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleConfirmImport = async () => {
    if (!parseResult) return

    // Collect valid & non-duplicate questions
    const validNonDuplicates = parseResult.questions.filter(
      (q) => q.isValid && !q.isDuplicate && q.correct_answer !== null
    )

    if (validNonDuplicates.length === 0) {
      alert('No valid, non-duplicate questions available to import.')
      return
    }

    setImporting(true)

    const questionsToInsert = validNonDuplicates.map((q) => ({
      question_text: q.question_text,
      section: targetSection,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer!,
      marks: 1,
      difficulty: targetDifficulty,
      topic: targetTopic.trim() || undefined,
      is_active: true,
    }))

    try {
      const res = await questionService.createQuestionsBatch(questionsToInsert)

      const duplicateCount = parseResult.questions.filter((q) => q.isDuplicate).length
      const parserErrors = parseResult.questions.filter((q) => !q.isValid).length
      const failedCount = res.failed || 0

      setSummaryStats({
        totalFound: parseResult.totalFound,
        importedCount: res.successCount,
        duplicateCount,
        errorCount: parserErrors + failedCount,
      })

      setImportCompleted(true)
      onImportSuccess()
    } catch (err: any) {
      console.error('Failed to import questions:', err)
      alert('Error inserting questions into Question Bank: ' + (err?.message || 'Unknown error'))
    } finally {
      setImporting(false)
    }
  }

  // Filter parsed items for display
  const getFilteredQuestions = () => {
    if (!parseResult) return []
    return parseResult.questions.filter((q) => {
      if (activeFilter === 'valid') return q.isValid && !q.isDuplicate
      if (activeFilter === 'duplicate') return q.isDuplicate
      if (activeFilter === 'error') return !q.isValid
      return true
    })
  }

  const filteredList = getFilteredQuestions()
  const duplicateCount = parseResult?.questions.filter((q) => q.isDuplicate).length || 0
  const validNonDupCount = parseResult?.questions.filter((q) => q.isValid && !q.isDuplicate).length || 0

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Import Questions from Notepad</h2>
              <p className="text-xs text-slate-500">
                Upload a standard .txt file to automatically extract MCQ questions and options.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          {!file && !importCompleted && (
            <div className="space-y-6">
              {/* File Upload Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 transition-all rounded-3xl p-8 text-center cursor-pointer space-y-3 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Click to upload or drag & drop Notepad (.txt) file
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Supports UTF-8 encoded text files</p>
                </div>
              </div>

              {/* Supported Format Guide */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Supported Notepad Format Examples:</span>
                </div>
                <pre className="text-[11px] font-mono bg-white p-3 rounded-xl border border-slate-200 text-slate-800 overflow-x-auto leading-relaxed">
{`1. What is the usage of simple present tense?
   Past action
   Action happening now
   >Regular action
   Future action

2. Which language is used for web styling?
   A) HTML
   B) Python
   C) CSS *
   D) Java`}
                </pre>
                <p className="text-[11px] text-slate-500 italic">
                  Note: Mark the correct answer with <strong>&gt;</strong>, <strong>*</strong>, or <strong>[CORRECT]</strong>. Unlimited questions supported!
                </p>
              </div>
            </div>
          )}

          {file && !importCompleted && parseResult && (
            <div className="space-y-6">
              {/* Batch Settings */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Target Section *
                  </label>
                  <select
                    value={targetSection}
                    onChange={(e) => setTargetSection(e.target.value as QuestionSection)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500"
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
                    value={targetDifficulty}
                    onChange={(e) => setTargetDifficulty(e.target.value as QuestionDifficulty)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Topic Tag (Optional)
                  </label>
                  <input
                    type="text"
                    value={targetTopic}
                    onChange={(e) => setTargetTopic(e.target.value)}
                    placeholder="e.g. Speed & Distance"
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Overview Counter Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-950 text-white p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-medium text-slate-300">File Loaded:</span>
                  <span className="text-xs font-bold text-white bg-indigo-900/80 px-2.5 py-1 rounded-lg">
                    {file.name}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="bg-indigo-900 px-3 py-1 rounded-lg font-bold">
                    Total: {parseResult.totalFound}
                  </span>
                  <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-3 py-1 rounded-lg font-bold">
                    Valid: {validNonDupCount}
                  </span>
                  {duplicateCount > 0 && (
                    <span className="bg-amber-950 text-amber-300 border border-amber-800 px-3 py-1 rounded-lg font-bold">
                      Duplicates: {duplicateCount}
                    </span>
                  )}
                  {parseResult.errorCount > 0 && (
                    <span className="bg-rose-950 text-rose-300 border border-rose-800 px-3 py-1 rounded-lg font-bold">
                      Errors: {parseResult.errorCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                    }`}
                  >
                    All ({parseResult.questions.length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('valid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFilter === 'valid'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                    }`}
                  >
                    Valid Ready ({validNonDupCount})
                  </button>
                  {duplicateCount > 0 && (
                    <button
                      onClick={() => setActiveFilter('duplicate')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        activeFilter === 'duplicate'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                      }`}
                    >
                      Duplicates ({duplicateCount})
                    </button>
                  )}
                  {parseResult.errorCount > 0 && (
                    <button
                      onClick={() => setActiveFilter('error')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        activeFilter === 'error'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 bg-slate-100'
                      }`}
                    >
                      Errors ({parseResult.errorCount})
                    </button>
                  )}
                </div>

                <button
                  onClick={handleReset}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                >
                  Choose Different File
                </button>
              </div>

              {/* Questions Preview List */}
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                {filteredList.map((q, idx) => (
                  <div
                    key={q.temp_id}
                    className={`p-5 rounded-2xl border space-y-3 transition-all ${
                      !q.isValid
                        ? 'bg-rose-50/50 border-rose-200'
                        : q.isDuplicate
                        ? 'bg-amber-50/50 border-amber-200'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                          {q.raw_number || idx + 1}
                        </span>

                        {q.isValid && !q.isDuplicate && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Valid MCQ
                          </span>
                        )}

                        {q.isDuplicate && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Duplicate (Will Skip)
                          </span>
                        )}

                        {!q.isValid && (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Validation Error
                          </span>
                        )}
                      </div>

                      {q.correct_answer && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-xl">
                          Correct: Option {q.correct_answer}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                      {q.question_text || <em className="text-slate-400">Empty Question Text</em>}
                    </p>

                    {!q.isValid && q.validationError && (
                      <div className="p-2.5 rounded-xl bg-rose-100/80 border border-rose-300 text-rose-800 text-xs font-medium flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                        <span>{q.validationError}</span>
                      </div>
                    )}

                    {/* 4 Options Display */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                        const optVal = q[`option_${optKey.toLowerCase()}` as keyof ParsedQuestion] as string
                        const isCorrect = q.correct_answer === optKey

                        return (
                          <div
                            key={optKey}
                            className={`p-2.5 rounded-xl border flex items-center justify-between ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-400 font-bold text-emerald-950 shadow-2xs'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span>
                              <strong className="mr-1.5 text-slate-500">{optKey}.</strong>{' '}
                              {optVal || <em className="text-slate-400">[Blank]</em>}
                            </span>
                            {isCorrect && (
                              <span className="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-200/80 px-2 py-0.5 rounded-md">
                                Marked Correct ✓
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {importCompleted && summaryStats && (
            <div className="py-8 text-center space-y-6 bg-emerald-50/60 rounded-3xl border border-emerald-200 p-8">
              <div className="w-16 h-16 bg-emerald-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-200 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">Import Completed Successfully!</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Questions have been added to the Question Bank database.
                </p>
              </div>

              <div className="max-w-md mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs">
                <div className="p-2">
                  <div className="text-lg font-black text-slate-800">{summaryStats.totalFound}</div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Found</div>
                </div>
                <div className="p-2 border-l border-slate-100">
                  <div className="text-lg font-black text-emerald-600">{summaryStats.importedCount}</div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Imported</div>
                </div>
                <div className="p-2 border-l border-slate-100">
                  <div className="text-lg font-black text-amber-600">{summaryStats.duplicateCount}</div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Skipped</div>
                </div>
                <div className="p-2 border-l border-slate-100">
                  <div className="text-lg font-black text-rose-600">{summaryStats.errorCount}</div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Errors</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
          >
            {importCompleted ? 'Close' : 'Cancel'}
          </button>

          {!importCompleted && parseResult && (
            <button
              type="button"
              disabled={importing || validNonDupCount === 0}
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 disabled:opacity-50 transition-all cursor-pointer"
            >
              {importing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Importing Questions...</span>
                </>
              ) : (
                <>
                  <span>Import {validNonDupCount} Questions</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}

          {importCompleted && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700"
            >
              View in Question Bank
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
