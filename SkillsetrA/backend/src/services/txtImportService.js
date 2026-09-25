export function parseQuestionTxt(fileContent, defaultCategory = 'APTITUDE', defaultDifficulty = 'MEDIUM') {
  const lines = fileContent.split(/\r?\n/)
  const parsedQuestions = []
  const errors = []

  let currentQuestion = null

  function finalizeQuestion() {
    if (!currentQuestion) return

    // Validation checks
    if (!currentQuestion.question_text || currentQuestion.question_text.trim() === '') {
      errors.push(`Question text is missing for question block near: "${currentQuestion.question_text || 'Unknown'}"`)
      currentQuestion = null
      return
    }
    if (!currentQuestion.option_a || !currentQuestion.option_b || !currentQuestion.option_c || !currentQuestion.option_d) {
      errors.push(`Missing one or more options for question: "${currentQuestion.question_text.substring(0, 40)}..."`)
      currentQuestion = null
      return
    }
    if (!currentQuestion.correct_option || !['A', 'B', 'C', 'D'].includes(currentQuestion.correct_option)) {
      errors.push(`Invalid or missing answer key for question: "${currentQuestion.question_text.substring(0, 40)}..."`)
      currentQuestion = null
      return
    }

    parsedQuestions.push({
      question_text: currentQuestion.question_text.trim(),
      option_a: currentQuestion.option_a.trim(),
      option_b: currentQuestion.option_b.trim(),
      option_c: currentQuestion.option_c.trim(),
      option_d: currentQuestion.option_d.trim(),
      correct_option: currentQuestion.correct_option.trim().toUpperCase(),
      category: (currentQuestion.category || defaultCategory).toLowerCase(),
      difficulty: (currentQuestion.difficulty || defaultDifficulty).toLowerCase(),
    })

    currentQuestion = null
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trim()
    if (!line) continue

    // Option A
    const optAMatch = line.match(/^[A|a][\.\)\:\-]\s*(.*)/)
    if (optAMatch && currentQuestion) {
      currentQuestion.option_a = optAMatch[1]
      continue
    }

    // Option B
    const optBMatch = line.match(/^[B|b][\.\)\:\-]\s*(.*)/)
    if (optBMatch && currentQuestion) {
      currentQuestion.option_b = optBMatch[1]
      continue
    }

    // Option C
    const optCMatch = line.match(/^[C|c][\.\)\:\-]\s*(.*)/)
    if (optCMatch && currentQuestion) {
      currentQuestion.option_c = optCMatch[1]
      continue
    }

    // Option D
    const optDMatch = line.match(/^[D|d][\.\)\:\-]\s*(.*)/)
    if (optDMatch && currentQuestion) {
      currentQuestion.option_d = optDMatch[1]
      continue
    }

    // Answer Line: "Answer: C" or "Ans: A" or "Correct Answer: B"
    const ansMatch = line.match(/^(?:Answer|Ans|Correct Answer)\s*[:\-]?\s*([A-Da-d])/i)
    if (ansMatch && currentQuestion) {
      currentQuestion.correct_option = ansMatch[1].toUpperCase()
      finalizeQuestion()
      continue
    }

    // Category Line: "Category: VERBAL"
    const catMatch = line.match(/^Category\s*[:\-]\s*(APTITUDE|VERBAL)/i)
    if (catMatch && currentQuestion) {
      currentQuestion.category = catMatch[1].toUpperCase()
      continue
    }

    // Difficulty Line: "Difficulty: EASY"
    const diffMatch = line.match(/^Difficulty\s*[:\-]\s*(EASY|MEDIUM|HARD)/i)
    if (diffMatch && currentQuestion) {
      currentQuestion.difficulty = diffMatch[1].toUpperCase()
      continue
    }

    // Question Number / New Question line (e.g. "1. What is..." or "Q1: What is...")
    const qNumMatch = line.match(/^(?:Q\d+|Question\s*\d+|\d+)[\.\)\:\-]\s*(.*)/i)
    if (qNumMatch) {
      if (currentQuestion) {
        finalizeQuestion()
      }
      currentQuestion = {
        question_text: qNumMatch[1] || line,
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: '',
        category: defaultCategory,
        difficulty: defaultDifficulty,
      }
      continue
    }

    // Continuation of question text or new unnumbered question
    if (!currentQuestion) {
      currentQuestion = {
        question_text: line,
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: '',
        category: defaultCategory,
        difficulty: defaultDifficulty,
      }
    } else if (!currentQuestion.option_a) {
      currentQuestion.question_text += ' ' + line
    }
  }

  if (currentQuestion) {
    finalizeQuestion()
  }

  return {
    total: parsedQuestions.length + errors.length,
    successful: parsedQuestions.length,
    failed: errors.length,
    questions: parsedQuestions,
    errors: errors,
  }
}
