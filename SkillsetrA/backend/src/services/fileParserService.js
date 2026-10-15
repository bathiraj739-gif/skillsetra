const xlsx = require('xlsx');
const pool = require('../config/db');

/**
 * Normalizes string for fuzzy duplicate detection.
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s]/gi, '') // remove punctuation
    .replace(/\s+/g, ' ')     // collapse whitespace
    .trim();
}

/**
 * Safely strips HTML tags and script/style elements.
 */
function sanitizeHtmlContent(htmlString) {
  if (!htmlString) return '';
  return htmlString
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // remove script tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')   // remove style tags
    .replace(/<[^>]+>/g, ' ')                                         // remove html tags
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse uploaded Question Bank file (.xlsx, .csv, .txt, .html)
 */
async function parseQuestionFile(buffer, filename, mimetype) {
  const ext = filename.split('.').pop().toLowerCase();
  let rawRows = [];

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || mimetype.includes('excel') || mimetype.includes('csv') || mimetype.includes('spreadsheet')) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  } else if (ext === 'txt') {
    const textContent = buffer.toString('utf-8');
    return parseTxtQuestions(textContent);
  } else if (ext === 'html' || ext === 'htm') {
    const htmlText = buffer.toString('utf-8');
    const cleanText = sanitizeHtmlContent(htmlText);
    return parseTxtQuestions(cleanText);
  } else {
    throw new Error('UNSUPPORTED_FILE_FORMAT: Only .xlsx, .csv, .txt, and .html are supported.');
  }

  // Process Excel/CSV raw rows
  const parsedQuestions = [];
  const invalidRows = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const questionText = (row['Question'] || row['Question Text'] || row['QuestionText'] || row['question'] || row['question_text'] || '').toString().trim();
    const optionA = (row['A'] || row['Option A'] || row['OptionA'] || row['option_a'] || '').toString().trim();
    const optionB = (row['B'] || row['Option B'] || row['OptionB'] || row['option_b'] || '').toString().trim();
    const optionC = (row['C'] || row['Option C'] || row['OptionC'] || row['option_c'] || '').toString().trim();
    const optionD = (row['D'] || row['Option D'] || row['OptionD'] || row['option_d'] || '').toString().trim();
    let correctOption = (row['Correct Answer'] || row['Correct Option'] || row['Answer'] || row['correct_option'] || row['Correct'] || '').toString().trim().toUpperCase();
    const category = (row['Category'] || row['category'] || 'APTITUDE').toString().trim().toUpperCase();
    const difficulty = (row['Difficulty'] || row['difficulty'] || 'MEDIUM').toString().trim().toUpperCase();
    const marks = Number(row['Marks'] || row['marks']) || 1;

    if (!questionText && !optionA && !optionB) {
      continue; // empty row
    }

    // Correct option map (1/2/3/4 -> A/B/C/D)
    if (['1', '2', '3', '4'].includes(correctOption)) {
      const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
      correctOption = map[correctOption];
    }

    if (!questionText || !optionA || !optionB || !optionC || !optionD || !['A', 'B', 'C', 'D'].includes(correctOption)) {
      invalidRows.push({
        rowNumber: i + 2,
        reason: 'Missing required question text, options, or valid correct answer (A, B, C, D)',
        data: row
      });
      continue;
    }

    parsedQuestions.push({
      rowNumber: i + 2,
      question_text: questionText,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_option: correctOption,
      category: ['APTITUDE', 'VERBAL'].includes(category) ? category : 'APTITUDE',
      difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty : 'MEDIUM',
      marks
    });
  }

  // Perform Duplicate Detection against database questions
  const duplicateResults = await performQuestionDuplicateCheck(parsedQuestions);

  return {
    fileInfo: { filename, totalRowsDetected: rawRows.length },
    summary: {
      totalParsed: parsedQuestions.length,
      validCount: duplicateResults.validQuestions.length,
      exactDuplicatesCount: duplicateResults.exactDuplicates.length,
      potentialDuplicatesCount: duplicateResults.potentialDuplicates.length,
      invalidCount: invalidRows.length
    },
    validQuestions: duplicateResults.validQuestions,
    exactDuplicates: duplicateResults.exactDuplicates,
    potentialDuplicates: duplicateResults.potentialDuplicates,
    invalidRows
  };
}

/**
 * TXT / HTML / Notepad Question parser supporting both prefixed (A., B., C., D.) and sequential lines with > marker.
 */
async function parseTxtQuestions(fileContent, filename = 'text_file.txt') {
  const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rawQuestions = [];
  const invalidRows = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for > symbol indicating correct option (e.g. >New Delhi or >40)
    let isMarkedCorrect = false;
    let cleanLine = line;
    if (cleanLine.startsWith('>')) {
      isMarkedCorrect = true;
      cleanLine = cleanLine.substring(1).trim();
    }

    const qMatch = cleanLine.match(/^(?:Q\d+|Question\s*\d+|\d+)[\.\)\:\-]\s*(.*)/i);
    // If it's a new question number (e.g. "1. What is ...")
    if (qMatch) {
      if (current && isValidQuestionObject(current)) {
        rawQuestions.push(current);
      } else if (current) {
        invalidRows.push({
          rowNumber: i,
          reason: 'Incomplete question or missing 4 options / correct answer',
          data: current
        });
      }
      current = {
        question_text: qMatch[1] || cleanLine,
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: '',
        category: 'APTITUDE',
        difficulty: 'MEDIUM',
        marks: 1
      };
      continue;
    }

    if (current) {
      const optAMatch = cleanLine.match(/^(?:[A|a][\.\)\:\-]\s*|\(A\)\s*)(.*)/);
      const optBMatch = cleanLine.match(/^(?:[B|b][\.\)\:\-]\s*|\(B\)\s*)(.*)/);
      const optCMatch = cleanLine.match(/^(?:[C|c][\.\)\:\-]\s*|\(C\)\s*)(.*)/);
      const optDMatch = cleanLine.match(/^(?:[D|d][\.\)\:\-]\s*|\(D\)\s*)(.*)/);

      if (optAMatch) {
        current.option_a = optAMatch[1];
        if (isMarkedCorrect) current.correct_option = 'A';
      } else if (optBMatch) {
        current.option_b = optBMatch[1];
        if (isMarkedCorrect) current.correct_option = 'B';
      } else if (optCMatch) {
        current.option_c = optCMatch[1];
        if (isMarkedCorrect) current.correct_option = 'C';
      } else if (optDMatch) {
        current.option_d = optDMatch[1];
        if (isMarkedCorrect) current.correct_option = 'D';
      } else if (/^(?:Answer|Ans|Correct Answer|Correct)\s*[:\-]?\s*([A-Da-d])/i.test(cleanLine)) {
        const ansMatch = cleanLine.match(/^(?:Answer|Ans|Correct Answer|Correct)\s*[:\-]?\s*([A-Da-d])/i);
        if (ansMatch) current.correct_option = ansMatch[1].toUpperCase();
      } else {
        // Sequential plain option lines (Line 1 = A, Line 2 = B, Line 3 = C, Line 4 = D)
        if (!current.option_a) {
          current.option_a = cleanLine;
          if (isMarkedCorrect) current.correct_option = 'A';
        } else if (!current.option_b) {
          current.option_b = cleanLine;
          if (isMarkedCorrect) current.correct_option = 'B';
        } else if (!current.option_c) {
          current.option_c = cleanLine;
          if (isMarkedCorrect) current.correct_option = 'C';
        } else if (!current.option_d) {
          current.option_d = cleanLine;
          if (isMarkedCorrect) current.correct_option = 'D';
        } else {
          // Additional description line
          current.question_text += ' ' + cleanLine;
        }
      }
    } else {
      // First question without a "1." prefix
      current = {
        question_text: cleanLine,
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: '',
        category: 'APTITUDE',
        difficulty: 'MEDIUM',
        marks: 1
      };
    }
  }

  if (current && isValidQuestionObject(current)) {
    rawQuestions.push(current);
  } else if (current) {
    invalidRows.push({
      rowNumber: lines.length,
      reason: 'Incomplete question or missing 4 options / correct answer',
      data: current
    });
  }

  // Duplicate Check against DB
  const duplicateResults = await performQuestionDuplicateCheck(rawQuestions);

  return {
    fileInfo: { filename, totalRowsDetected: rawQuestions.length },
    summary: {
      totalParsed: rawQuestions.length,
      validCount: duplicateResults.validQuestions.length,
      exactDuplicatesCount: duplicateResults.exactDuplicates.length,
      potentialDuplicatesCount: duplicateResults.potentialDuplicates.length,
      invalidCount: invalidRows.length
    },
    validQuestions: duplicateResults.validQuestions,
    exactDuplicates: duplicateResults.exactDuplicates,
    potentialDuplicates: duplicateResults.potentialDuplicates,
    invalidRows
  };
}

function isValidQuestionObject(q) {
  return (
    q.question_text &&
    q.option_a &&
    q.option_b &&
    q.option_c &&
    q.option_d &&
    ['A', 'B', 'C', 'D'].includes(q.correct_option)
  );
}

/**
 * Perform exact & normalized duplicate detection for questions against PostgreSQL
 */
async function performQuestionDuplicateCheck(parsedQuestions) {
  const dbRes = await pool.query('SELECT id, question_text FROM questions WHERE is_active = true');
  const dbQuestions = dbRes.rows;

  const exactMap = new Set(dbQuestions.map(q => q.question_text.trim()));
  const normalizedMap = new Map(dbQuestions.map(q => [normalizeString(q.question_text), q.question_text]));

  const validQuestions = [];
  const exactDuplicates = [];
  const potentialDuplicates = [];
  const seenBatch = new Set();

  for (const q of parsedQuestions) {
    const rawText = q.question_text.trim();
    const normText = normalizeString(rawText);

    if (exactMap.has(rawText) || seenBatch.has(rawText)) {
      exactDuplicates.push({ ...q, reason: 'Exact match with existing question in Question Bank' });
    } else if (normalizedMap.has(normText)) {
      potentialDuplicates.push({
        ...q,
        matchedDbQuestion: normalizedMap.get(normText),
        reason: 'Similar punctuation/casing match with existing question'
      });
    } else {
      validQuestions.push(q);
      seenBatch.add(rawText);
    }
  }

  return {
    validQuestions,
    exactDuplicates,
    potentialDuplicates
  };
}

/**
 * Parse uploaded Candidate File (.xlsx, .csv)
 */
async function parseCandidateFile(buffer, filename, mimetype) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  const candidateList = rawRows.map(row => ({
    register_number: (row['Register Number'] || row['Register No'] || row['Reg No'] || row['register_number'] || '').toString().trim(),
    full_name: (row['Full Name'] || row['Name'] || row['full_name'] || '').toString().trim(),
    email: (row['Email'] || row['Email Address'] || row['email'] || '').toString().trim(),
    department: (row['Department'] || row['Dept'] || row['department'] || '').toString().trim(),
    year: (row['Year'] || row['Academic Year'] || row['year'] || '').toString().trim(),
    section: (row['Section'] || row['section'] || '').toString().trim(),
    phone: (row['Phone'] || row['Mobile'] || row['phone'] || '').toString().trim()
  })).filter(c => c.register_number || c.full_name);

  return {
    filename,
    candidates: candidateList
  };
}

module.exports = {
  parseQuestionFile,
  parseTxtQuestions,
  parseCandidateFile,
  sanitizeHtmlContent
};
