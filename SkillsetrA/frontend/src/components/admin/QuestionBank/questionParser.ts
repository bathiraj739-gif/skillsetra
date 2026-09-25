import type { QuestionOption } from '../../../types'

export interface ParsedQuestion {
  temp_id: string
  raw_number?: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: QuestionOption | null
  isValid: boolean
  validationError?: string
  isDuplicate?: boolean
}

export interface ParseResult {
  questions: ParsedQuestion[]
  totalFound: number
  validCount: number
  errorCount: number
}

/**
 * Checks if a line starts with a explicit option marker like "A)", "A.", "Option A", "a.", etc.
 */
function getExplicitOptionKey(line: string): QuestionOption | null {
  const trimmed = line.trim()
  // Matches "A)", "A.", "A:", "a)", "a.", "Option A", "Option A:", etc.
  const match = trimmed.match(/^(?:(?:Option\s+)?([ABCDabcd])[\)\.\:\-]?\s+)/i)
  if (match) {
    return match[1].toUpperCase() as QuestionOption
  }
  // Matches pure single letter "A", "B", "C", "D" followed by marker or space
  const pureLetterMatch = trimmed.match(/^([ABCDabcd])[\)\.\:\-]\s*/i)
  if (pureLetterMatch) {
    return pureLetterMatch[1].toUpperCase() as QuestionOption
  }
  return null
}

/**
 * Checks if a line starts a new question with a number prefix.
 * e.g., "1.", "1)", "100.", "1000.", "Q1:", "Question 1"
 */
function isQuestionHeaderLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  return /^(?:\d+[\)\.\:\-]|Q\d+[\:\.]|Question\s+\d+[\:\.])/i.test(trimmed)
}

/**
 * Processes option text to detect correct answer markers ('>', '*', '[CORRECT]')
 * and returns the cleaned text stripped of all markers.
 */
function processOptionText(rawLineText: string): { cleanedText: string; isCorrect: boolean } {
  let text = rawLineText.trim()
  let isCorrect = false

  // Check for '>' prefix or marker (e.g. ">Regular action", "> Went", "Option B >")
  if (text.includes('>')) {
    isCorrect = true
    text = text.replace(/>/g, '')
  }

  // Check for '[CORRECT]' marker
  if (/\[CORRECT\]/i.test(text)) {
    isCorrect = true
    text = text.replace(/\[CORRECT\]/gi, '')
  }

  // Check for '*' marker
  if (text.includes('*')) {
    isCorrect = true
    text = text.replace(/\*/g, '')
  }

  // Also remove option label if present at start e.g. "Option A", "A)"
  text = text.replace(/^(?:Option\s+[ABCDabcd][\)\.\:\-]?|[ABCDabcd][\)\.\:\-])\s*/i, '')

  text = text.replace(/\s+/g, ' ').trim()

  return { cleanedText: text, isCorrect }
}

/**
 * Dynamic parser supporting unlimited questions from Notepad .txt files.
 */
export function parseQuestionFile(fileText: string): ParseResult {
  // Normalize line endings
  const lines = fileText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  const questionBlocks: string[][] = []
  let currentBlock: string[] = []

  // Chunk lines into individual question blocks based on question headers or empty line separators
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      // Empty line: if currentBlock has content and ends a previous block structure, push it
      continue
    }

    if (isQuestionHeaderLine(trimmed)) {
      if (currentBlock.length > 0) {
        questionBlocks.push(currentBlock)
      }
      currentBlock = [line]
    } else {
      if (currentBlock.length === 0) {
        currentBlock = [line]
      } else {
        currentBlock.push(line)
      }
    }
  }

  if (currentBlock.length > 0) {
    questionBlocks.push(currentBlock)
  }

  // Fallback chunker if no explicit question numbers were found (e.g. raw text separated by blank lines)
  let blocksToProcess = questionBlocks
  if (questionBlocks.length === 1 && lines.filter((l) => l.trim()).length > 5) {
    // Attempt splitting by empty line groups
    const rawGroups: string[][] = []
    let group: string[] = []
    lines.forEach((l) => {
      if (!l.trim()) {
        if (group.length > 0) {
          rawGroups.push(group)
          group = []
        }
      } else {
        group.push(l)
      }
    })
    if (group.length > 0) rawGroups.push(group)

    if (rawGroups.length > 1) {
      blocksToProcess = rawGroups
    }
  }

  const parsedQuestions: ParsedQuestion[] = []

  blocksToProcess.forEach((blockLines, index) => {
    // Filter out purely empty lines inside block
    const nonEmpLines = blockLines.map((l) => l.trim()).filter(Boolean)
    if (nonEmpLines.length === 0) return

    let questionTextLines: string[] = []
    const markedCorrectList: QuestionOption[] = []
    const optionMap: Record<QuestionOption, string> = { A: '', B: '', C: '', D: '' }

    // Check if block uses explicit option markers (A), B), C), D) or Option A, Option B)
    const hasExplicitOptionMarkers = nonEmpLines.some((l) => getExplicitOptionKey(l) !== null)

    if (hasExplicitOptionMarkers) {
      let currentOpt: QuestionOption | null = null
      const optionTextCollector: Record<QuestionOption, string[]> = { A: [], B: [], C: [], D: [] }

      nonEmpLines.forEach((line) => {
        const optKey = getExplicitOptionKey(line)
        if (optKey) {
          currentOpt = optKey
          optionTextCollector[optKey].push(line)
        } else if (currentOpt) {
          // Multi-line option text
          optionTextCollector[currentOpt].push(line)
        } else {
          // Question text line
          questionTextLines.push(line)
        }
      })

      ;(['A', 'B', 'C', 'D'] as QuestionOption[]).forEach((opt) => {
        const rawOptText = (optionTextCollector[opt] || []).join(' ')
        if (rawOptText) {
          const { cleanedText, isCorrect } = processOptionText(rawOptText)
          optionMap[opt] = cleanedText
          if (isCorrect) markedCorrectList.push(opt)
        }
      })
    } else {
      // Unlabeled option format: First lines are question text, last 4 lines are options A, B, C, D
      if (nonEmpLines.length >= 5) {
        const rawOptions = nonEmpLines.slice(-4)
        questionTextLines = nonEmpLines.slice(0, nonEmpLines.length - 4)

        const optionKeys: QuestionOption[] = ['A', 'B', 'C', 'D']
        rawOptions.forEach((optLine, i) => {
          const optKey = optionKeys[i]
          const { cleanedText, isCorrect } = processOptionText(optLine)
          optionMap[optKey] = cleanedText
          if (isCorrect) markedCorrectList.push(optKey)
        })
      } else {
        // Less than 5 lines in block -> question text + partial options
        questionTextLines = nonEmpLines
      }
    }

    // Process & clean Question Text
    let rawQText = questionTextLines.join(' ').trim()
    // Strip leading question number (e.g. "1.", "12)", "Q3:", "Question 4:")
    rawQText = rawQText.replace(/^(?:\d+[\)\.\:\-]|Q\d+[\:\.]|Question\s+\d+[\:\.])\s*/i, '')

    // Validation
    let isValid = true
    let validationError: string | undefined = undefined
    let detectedCorrectAnswer: QuestionOption | null = null

    const missingOptions: QuestionOption[] = []
    ;(['A', 'B', 'C', 'D'] as QuestionOption[]).forEach((opt) => {
      if (!optionMap[opt]) missingOptions.push(opt)
    })

    if (!rawQText) {
      isValid = false
      validationError = 'Question text is missing.'
    } else if (missingOptions.length > 0) {
      isValid = false
      if (missingOptions.length === 4) {
        validationError = 'Four options were not detected.'
      } else {
        validationError = `Missing option text for Option (${missingOptions.join(', ')}).`
      }
    } else if (markedCorrectList.length === 0) {
      isValid = false
      validationError = 'Correct answer is missing (No option marked with >, *, or [CORRECT]).'
    } else if (markedCorrectList.length > 1) {
      isValid = false
      validationError = `Multiple correct answers found (${markedCorrectList.join(', ')}). Exactly one is required.`
    } else {
      detectedCorrectAnswer = markedCorrectList[0]
    }

    parsedQuestions.push({
      temp_id: `parsed-${index + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      raw_number: `${index + 1}`,
      question_text: rawQText,
      option_a: optionMap.A,
      option_b: optionMap.B,
      option_c: optionMap.C,
      option_d: optionMap.D,
      correct_answer: detectedCorrectAnswer,
      isValid,
      validationError,
    })
  })

  const validCount = parsedQuestions.filter((q) => q.isValid).length
  const errorCount = parsedQuestions.length - validCount

  return {
    questions: parsedQuestions,
    totalFound: parsedQuestions.length,
    validCount,
    errorCount,
  }
}
