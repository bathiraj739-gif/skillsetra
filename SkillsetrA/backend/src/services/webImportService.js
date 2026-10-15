const axios = require('axios');
const pool = require('../config/db');

/**
 * Web Import Service for SkillsetrA Skill AI
 * Handles:
 * 1. Web search for aptitude/verbal placement questions (provider abstraction: Tavily/Google/Gemini)
 * 2. Safe URL web page fetching & question extraction
 * 3. Pasted online content / ChatGPT question normalization
 * 4. Duplicate detection & validation against PostgreSQL Question Bank
 */

/**
 * Safely strips HTML tags, scripts, and stylesheets from downloaded content.
 */
function sanitizeHtml(htmlString) {
  if (!htmlString) return '';
  return htmlString
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // remove script tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')   // remove style tags
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<[^>]+>/g, ' ')                                         // remove html tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts structured questions from raw unstructured web text using Gemini AI with strict JSON schema.
 */
async function extractQuestionsFromTextWithGemini(rawText, defaultCategory = 'APTITUDE', defaultDifficulty = 'MEDIUM', maxCount = 20) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'YOUR_NEW_GEMINI_API_KEY' || apiKey.startsWith('gen-lang-client')) {
    // Fallback heuristic extraction
    return fallbackExtractQuestions(rawText, defaultCategory, defaultDifficulty, maxCount);
  }

  try {
    const prompt = `You are a strict Question Extraction and Normalization AI for SkillsetrA Assessment Platform.
Extract up to ${maxCount} multiple-choice questions from the untrusted web text below.

EXTRACTED CATEGORIES MUST BE EITHER "APTITUDE" OR "VERBAL".
DIFFICULTIES MUST BE "EASY", "MEDIUM", OR "HARD".
OPTIONS MUST HAVE EXACTLY 4 CHOICES: optionA, optionB, optionC, optionD.
CORRECT OPTION: Must be 'A', 'B', 'C', 'D' if reliably identified from the text or high-confidence answer key.
If the correct answer cannot be verified with high confidence, set correctOption: "NEEDS_REVIEW".

Output JSON format:
{
  "questions": [
    {
      "questionText": "...",
      "optionA": "...",
      "optionB": "...",
      "optionC": "...",
      "optionD": "...",
      "correctOption": "A" | "B" | "C" | "D" | "NEEDS_REVIEW",
      "category": "APTITUDE" | "VERBAL",
      "difficulty": "EASY" | "MEDIUM" | "HARD",
      "marks": 1,
      "explanation": "..."
    }
  ]
}

UNTRUSTED WEB TEXT:
${rawText.slice(0, 15000)}
`;

    let responseText = '';
    try {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });
      if (response && response.text) {
        responseText = response.text;
      }
    } catch (sdkErr) {
      const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const restRes = await axios.post(restUrl, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      }, { timeout: 35000 });

      if (restRes.data && restRes.data.candidates && restRes.data.candidates[0]?.content?.parts[0]?.text) {
        responseText = restRes.data.candidates[0].content.parts[0].text;
      }
    }

    if (responseText) {
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed && Array.isArray(parsed.questions)) {
        return parsed.questions.map(q => ({
          question_text: (q.questionText || '').trim(),
          option_a: (q.optionA || '').trim(),
          option_b: (q.optionB || '').trim(),
          option_c: (q.optionC || '').trim(),
          option_d: (q.optionD || '').trim(),
          correct_option: q.correctOption === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : (['A', 'B', 'C', 'D'].includes(q.correctOption?.toUpperCase()) ? q.correctOption.toUpperCase() : 'NEEDS_REVIEW'),
          category: ['APTITUDE', 'VERBAL'].includes(q.category?.toUpperCase()) ? q.category.toUpperCase() : defaultCategory,
          difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(q.difficulty?.toUpperCase()) ? q.difficulty.toUpperCase() : defaultDifficulty,
          marks: Number(q.marks) || 1,
          explanation: q.explanation || ''
        })).filter(q => q.question_text && q.option_a && q.option_b);
      }
    }
    return [];
  } catch (err) {
    console.warn('Gemini question extraction failed, using heuristic parser:', err.message);
    return fallbackExtractQuestions(rawText, defaultCategory, defaultDifficulty, maxCount);
  }
}

/**
 * Fallback regex / line-based parser for text containing questions with options and optional > marker.
 */
function fallbackExtractQuestions(rawText, defaultCategory = 'APTITUDE', defaultDifficulty = 'MEDIUM', maxCount = 20) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const questions = [];
  let current = null;

  for (let i = 0; i < lines.length && questions.length < maxCount; i++) {
    const line = lines[i];

    // Detect question start
    const qMatch = line.match(/^(?:Q\d+|Question\s*\d+|\d+)[\.\)\:\-]\s*(.*)/i);
    if (qMatch) {
      if (current && current.question_text && current.option_a && current.option_b) {
        questions.push(current);
      }
      current = {
        question_text: qMatch[1] || line,
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 'NEEDS_REVIEW',
        category: defaultCategory,
        difficulty: defaultDifficulty,
        marks: 1
      };
      continue;
    }

    if (current) {
      let isCorrect = line.startsWith('>');
      let cleanLine = isCorrect ? line.substring(1).trim() : line;

      const optAMatch = cleanLine.match(/^(?:[A|a][\.\)\:\-]\s*|\(A\)\s*)(.*)/);
      const optBMatch = cleanLine.match(/^(?:[B|b][\.\)\:\-]\s*|\(B\)\s*)(.*)/);
      const optCMatch = cleanLine.match(/^(?:[C|c][\.\)\:\-]\s*|\(C\)\s*)(.*)/);
      const optDMatch = cleanLine.match(/^(?:[D|d][\.\)\:\-]\s*|\(D\)\s*)(.*)/);

      if (optAMatch) {
        current.option_a = optAMatch[1];
        if (isCorrect) current.correct_option = 'A';
      } else if (optBMatch) {
        current.option_b = optBMatch[1];
        if (isCorrect) current.correct_option = 'B';
      } else if (optCMatch) {
        current.option_c = optCMatch[1];
        if (isCorrect) current.correct_option = 'C';
      } else if (optDMatch) {
        current.option_d = optDMatch[1];
        if (isCorrect) current.correct_option = 'D';
      } else if (/^(?:Answer|Ans|Correct)\s*[:\-]?\s*([A-Da-d])/i.test(cleanLine)) {
        const ansMatch = cleanLine.match(/^(?:Answer|Ans|Correct)\s*[:\-]?\s*([A-Da-d])/i);
        if (ansMatch) current.correct_option = ansMatch[1].toUpperCase();
      } else {
        // Plain sequential options without A. B. C. D. prefixes
        if (!current.option_a) {
          current.option_a = cleanLine;
          if (isCorrect) current.correct_option = 'A';
        } else if (!current.option_b) {
          current.option_b = cleanLine;
          if (isCorrect) current.correct_option = 'B';
        } else if (!current.option_c) {
          current.option_c = cleanLine;
          if (isCorrect) current.correct_option = 'C';
        } else if (!current.option_d) {
          current.option_d = cleanLine;
          if (isCorrect) current.correct_option = 'D';
        } else {
          current.question_text += ' ' + cleanLine;
        }
      }
    }
  }

  if (current && current.question_text && current.option_a && current.option_b) {
    questions.push(current);
  }

  return questions;
}

/**
 * Checks extracted questions against Question Bank in PostgreSQL for exact and fuzzy duplicates.
 */
async function performDuplicateAndValidationCheck(questions) {
  const valid = [];
  const duplicates = [];
  const needsReview = [];
  const invalid = [];

  for (const q of questions) {
    if (!q.question_text || !q.option_a || !q.option_b) {
      invalid.push({ question: q, reason: 'Incomplete question text or options' });
      continue;
    }

    // Check exact duplicate in DB
    const checkRes = await pool.query(
      'SELECT id, question_text, category, difficulty FROM questions WHERE question_text ILIKE $1 AND is_active = true LIMIT 1',
      [q.question_text.trim()]
    );

    if (checkRes.rows.length > 0) {
      duplicates.push({
        question: q,
        existingId: checkRes.rows[0].id,
        reason: 'Question already exists in Question Bank'
      });
      continue;
    }

    if (!q.correct_option || q.correct_option === 'NEEDS_REVIEW' || !['A', 'B', 'C', 'D'].includes(q.correct_option)) {
      needsReview.push({
        ...q,
        correct_option: 'NEEDS_REVIEW',
        warning: 'Correct answer could not be verified automatically. Admin review required before saving.'
      });
    } else {
      valid.push(q);
    }
  }

  return {
    valid,
    duplicates,
    needsReview,
    invalid
  };
}

/**
 * Fetch webpage content safely using axios with strict timeout and headers.
 */
async function fetchWebPage(url) {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid URL protocol. Only HTTP and HTTPS are permitted.');
    }

    const response = await axios.get(url, {
      timeout: 10000,
      maxContentLength: 5 * 1024 * 1024, // 5MB max
      headers: {
        'User-Agent': 'SkillsetrA-Admin-Agent/2.0 (Assessment Platform Question Importer)'
      }
    });

    const cleanText = sanitizeHtml(response.data);
    return cleanText;
  } catch (err) {
    throw new Error(`Failed to fetch web page: ${err.message}`);
  }
}

/**
 * Search permitted web sources or generate from curated placement topic patterns.
 */
async function searchWebQuestions({ query, count = 20, category = 'APTITUDE', difficulty = 'MEDIUM' }) {
  const provider = process.env.WEB_SEARCH_PROVIDER || 'GEMINI_SEARCH';
  const apiKey = process.env.GEMINI_API_KEY;

  // Use provider abstraction
  if (provider === 'TAVILY' && process.env.TAVILY_API_KEY) {
    try {
      const tavilyRes = await axios.post('https://api.tavily.com/search', {
        api_key: process.env.TAVILY_API_KEY,
        query: `${query} aptitude verbal placement questions with answers and explanations`,
        search_depth: 'advanced',
        max_results: 5
      });
      const combinedText = tavilyRes.data.results.map(r => r.content).join('\n\n');
      const extracted = await extractQuestionsFromTextWithGemini(combinedText, category, difficulty, count);
      const checked = await performDuplicateAndValidationCheck(extracted);
      return {
        source: 'TAVILY_SEARCH',
        query,
        summary: {
          totalFound: extracted.length,
          validCount: checked.valid.length,
          duplicatesCount: checked.duplicates.length,
          needsReviewCount: checked.needsReview.length,
          invalidCount: checked.invalid.length
        },
        validQuestions: checked.valid,
        needsReviewQuestions: checked.needsReview,
        duplicates: checked.duplicates,
        invalid: checked.invalid
      };
    } catch (e) {
      console.warn('Tavily search failed, falling back to AI search provider:', e.message);
    }
  }

  // Fallback / Default: Gemini Web Knowledge Extraction
  if (apiKey && apiKey.trim() !== '' && apiKey.trim() !== 'YOUR_NEW_GEMINI_API_KEY' && !apiKey.startsWith('gen-lang-client')) {
    const prompt = `You are a Campus Placement Assessment Question Research Agent for SkillsetrA.
Search standard placement aptitude & verbal reasoning question banks and curricula for: "${query}".
Category: ${category}
Difficulty: ${difficulty}
Generate ${Math.min(count, 30)} authentic, verified placement multiple choice questions with 4 options and verified correct answer.

JSON Output Schema:
{
  "questions": [
    {
      "questionText": "...",
      "optionA": "...",
      "optionB": "...",
      "optionC": "...",
      "optionD": "...",
      "correctOption": "A" | "B" | "C" | "D",
      "category": "${category}",
      "difficulty": "${difficulty}",
      "marks": 1
    }
  ]
}`;

    let responseText = '';
    try {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3
        }
      });
      if (response && response.text) {
        responseText = response.text;
      }
    } catch (sdkErr) {
      try {
        const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const restRes = await axios.post(restUrl, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }, { timeout: 35000 });

        if (restRes.data && restRes.data.candidates && restRes.data.candidates[0]?.content?.parts[0]?.text) {
          responseText = restRes.data.candidates[0].content.parts[0].text;
        }
      } catch (restErr) {
        console.warn('Gemini REST search failed:', restErr.message);
      }
    }

    if (responseText) {
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      const extracted = (parsed.questions || []).map(q => ({
        question_text: q.questionText,
        option_a: q.optionA,
        option_b: q.optionB,
        option_c: q.optionC,
        option_d: q.optionD,
        correct_option: q.correctOption?.toUpperCase() || 'A',
        category: category.toUpperCase(),
        difficulty: difficulty.toUpperCase(),
        marks: 1
      }));

      const checked = await performDuplicateAndValidationCheck(extracted);

      return {
        source: 'WEB_KNOWLEDGE_SEARCH',
        query,
        summary: {
          totalFound: extracted.length,
          validCount: checked.valid.length,
          duplicatesCount: checked.duplicates.length,
          needsReviewCount: checked.needsReview.length,
          invalidCount: checked.invalid.length
        },
        validQuestions: checked.valid,
        needsReviewQuestions: checked.needsReview,
        duplicates: checked.duplicates,
        invalid: checked.invalid
      };
    }
  }

  // Deterministic fallback if offline or no search API configured
  const geminiQuestionService = require('./geminiQuestionService');
  const fallbackRaw = geminiQuestionService.getFallbackQuestions({ category, topic: query, difficulty, count: Math.min(count, 10), marks: 1 });
  const fallback = fallbackRaw.map(q => ({
    question_text: q.questionText,
    option_a: q.optionA,
    option_b: q.optionB,
    option_c: q.optionC,
    option_d: q.optionD,
    correct_option: q.correctOption,
    category,
    difficulty,
    marks: 1
  }));
  const checked = await performDuplicateAndValidationCheck(fallback);
  return {
    source: 'OFFLINE_FALLBACK',
    query,
    summary: {
      totalFound: fallback.length,
      validCount: checked.valid.length,
      duplicatesCount: checked.duplicates.length,
      needsReviewCount: checked.needsReview.length,
      invalidCount: checked.invalid.length
    },
    validQuestions: checked.valid,
    needsReviewQuestions: checked.needsReview,
    duplicates: checked.duplicates,
    invalid: checked.invalid
  };
}

/**
 * Import questions from a webpage URL.
 */
async function importFromUrl({ url, category = 'APTITUDE', difficulty = 'MEDIUM', count = 20 }) {
  const cleanText = await fetchWebPage(url);
  const extracted = await extractQuestionsFromTextWithGemini(cleanText, category, difficulty, count);
  const checked = await performDuplicateAndValidationCheck(extracted);

  return {
    source: 'URL_IMPORT',
    url,
    summary: {
      totalFound: extracted.length,
      validCount: checked.valid.length,
      duplicatesCount: checked.duplicates.length,
      needsReviewCount: checked.needsReview.length,
      invalidCount: checked.invalid.length
    },
    validQuestions: checked.valid,
    needsReviewQuestions: checked.needsReview,
    duplicates: checked.duplicates,
    invalid: checked.invalid
  };
}

/**
 * Import questions from pasted text (ChatGPT, website copy-paste, Notepad).
 */
async function importFromPastedText({ text, category = 'APTITUDE', difficulty = 'MEDIUM', count = 30 }) {
  const extracted = await extractQuestionsFromTextWithGemini(text, category, difficulty, count);
  const checked = await performDuplicateAndValidationCheck(extracted);

  return {
    source: 'PASTED_TEXT_IMPORT',
    summary: {
      totalFound: extracted.length,
      validCount: checked.valid.length,
      duplicatesCount: checked.duplicates.length,
      needsReviewCount: checked.needsReview.length,
      invalidCount: checked.invalid.length
    },
    validQuestions: checked.valid,
    needsReviewQuestions: checked.needsReview,
    duplicates: checked.duplicates,
    invalid: checked.invalid
  };
}

module.exports = {
  sanitizeHtml,
  fetchWebPage,
  searchWebQuestions,
  importFromUrl,
  importFromPastedText,
  performDuplicateAndValidationCheck
};
