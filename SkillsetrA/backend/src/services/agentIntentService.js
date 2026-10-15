const { INTENT_SYSTEM_PROMPT } = require('../agent/intentSchema');
const axios = require('axios');

/**
 * Fallback deterministic rule parser for common admin commands in English, Tamil, Tanglish, and Mixed speech.
 */
function fallbackRuleIntentParser(userMessage) {
  const msg = userMessage.toLowerCase().trim();

  // Helper to extract roll numbers (e.g. 23ADS001, 24AI001, REG123456)
  const rollMatches = userMessage.match(/\b\d{2}[A-Za-z]{2,5}\d{3,4}\b|\bREG\d+\b/gi);
  const rollNumbers = rollMatches ? Array.from(new Set(rollMatches.map(r => r.toUpperCase()))) : [];

  // 1. Web & Online Search / Import
  if (/online|web search|internet|thedu|search online|webpage|from url|http/i.test(msg)) {
    const urlMatch = userMessage.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      return {
        intent: 'EXTRACT_URL_QUESTIONS',
        explanation: `Extract questions from URL: ${urlMatch[0]}`,
        parameters: { url: urlMatch[0], category: msg.includes('verbal') ? 'VERBAL' : 'APTITUDE', count: 20 }
      };
    }
    let query = userMessage.replace(/find|search|online|questions|import|thedu|pannu|la/gi, '').trim() || 'Aptitude Placement';
    return {
      intent: 'WEB_SEARCH_IMPORT',
      explanation: `Search online for "${query}" placement questions`,
      parameters: { query, category: msg.includes('verbal') ? 'VERBAL' : 'APTITUDE', count: 20, difficulty: 'MEDIUM' }
    };
  }

  // 2. Roll Number or Department Specific Assignments (e.g. "Assign assessment <uuid> to all CSE third year students", "Assign Aptitude Test 1 to roll number 23ADS001", "23ADS001-ku assign pannu")
  if (/assign.*to|assign pannu|bulk assign|assign/i.test(msg)) {
    const uuidMatch = userMessage.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
    const assessmentId = uuidMatch ? uuidMatch[0] : undefined;

    let dept = null;
    let yr = null;
    if (msg.includes('ai') || msg.includes('data science')) dept = 'AI & Data Science';
    else if (msg.includes('cse') || msg.includes('computer')) dept = 'CSE';
    else if (msg.includes('ece') || msg.includes('electronics')) dept = 'ECE';
    else if (msg.includes('mech')) dept = 'Mechanical';
    else if (msg.includes('it') || msg.includes('information')) dept = 'Information Technology';

    if (msg.includes('third year') || msg.includes('3rd year') || msg.includes('year 3') || msg.includes('3rd')) yr = '3';
    else if (msg.includes('first year') || msg.includes('1st year') || msg.includes('year 1')) yr = '1';
    else if (msg.includes('second year') || msg.includes('2nd year') || msg.includes('year 2')) yr = '2';
    else if (msg.includes('final year') || msg.includes('4th year') || msg.includes('year 4')) yr = '4';

    let assTitle = null;
    if (msg.includes('aptitude test 1') || msg.includes('aptitude 1')) assTitle = 'Aptitude Test 1';
    else if (msg.includes('placement test 1') || msg.includes('placement 1')) assTitle = 'Placement Test 1';
    else if (msg.includes('verbal')) assTitle = 'Verbal Reasoning Assessment';

    return {
      intent: 'BULK_ASSIGN_ASSESSMENT',
      explanation: rollNumbers.length > 0
        ? `Assign assessment to ${rollNumbers.join(', ')}`
        : `Assign assessment to ${dept || 'all'} ${yr ? yr + 'rd year' : ''} students`,
      parameters: {
        assessment_id: assessmentId,
        assessmentId: assessmentId,
        assessment_title: assTitle || 'Placement Assessment',
        assessmentTitle: assTitle || 'Placement Assessment',
        roll_numbers: rollNumbers.length > 0 ? rollNumbers : undefined,
        studentRollNumbers: rollNumbers.length > 0 ? rollNumbers : undefined,
        department: dept,
        year: yr
      }
    };
  }

  // 3. Assessment Creation (e.g. "Create a 40 minute aptitude assessment with 30 questions called Placement Aptitude Round 1")
  if (/create.*assessment|build.*assessment|new assessment|assessment create pannu|create.*test|build.*test/i.test(msg)) {
    let duration = 40;
    let count = 30;
    const matches = msg.match(/\d+/g);
    if (matches && matches.length >= 1) duration = parseInt(matches[0], 10);
    if (matches && matches.length >= 2) count = parseInt(matches[1], 10);
    
    let title = msg.includes('verbal') ? 'Verbal Reasoning Assessment' : 'Placement Aptitude Assessment';
    const titleMatch = userMessage.match(/(?:called|named|title)\s+["']?([^"'\.\,]+)["']?/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }

    return {
      intent: 'CREATE_ASSESSMENT',
      explanation: `Create a ${duration}-minute assessment with ${count} questions`,
      parameters: { title, duration_minutes: duration, durationMinutes: duration, question_count: count, questionCount: count, category: msg.includes('verbal') ? 'VERBAL' : 'APTITUDE' }
    };
  }

  // 4. Question Generation / Creation (e.g. "Percentage la 20 medium questions create pannu", "Create 20 medium aptitude questions on percentage")
  if (/create.*question|generate.*question|questions.*create pannu|create pannu|question create/i.test(msg)) {
    let count = 10;
    const matchCount = msg.match(/\d+/);
    if (matchCount) count = parseInt(matchCount[0], 10);
    let category = msg.includes('verbal') ? 'VERBAL' : 'APTITUDE';
    let difficulty = msg.includes('hard') ? 'HARD' : (msg.includes('easy') ? 'EASY' : 'MEDIUM');

    let topic = 'General Placement';
    if (msg.includes('percentage')) topic = 'Percentage';
    else if (msg.includes('profit') || msg.includes('loss')) topic = 'Profit and Loss';
    else if (msg.includes('ratio') || msg.includes('proportion')) topic = 'Ratios and Proportions';
    else if (msg.includes('time') && (msg.includes('work') || msg.includes('distance'))) topic = 'Time and Work';
    else if (msg.includes('synonym') || msg.includes('antonym')) topic = 'Synonyms & Antonyms';

    return {
      intent: 'GENERATE_QUESTIONS',
      explanation: `Generate ${count} ${difficulty} ${category} questions on "${topic}" using AI`,
      parameters: { count, category, difficulty, topic }
    };
  }

  // 5. Result Lookup, Analytics & Student History (e.g. "Analyze Aptitude Test 1", "23ADS001 oda result kaatu", "Show result of roll number 23ADS001", "Show previous tests of 23ADS001")
  if (/result|score|mark|history|previous attempt|previous test|oda result|result kaatu|analyze|analysis|performance|statistics/i.test(msg)) {
    if (rollNumbers.length > 0) {
      if (/history|previous/i.test(msg)) {
        return {
          intent: 'VIEW_STUDENT_HISTORY',
          explanation: `View candidate assessment history for ${rollNumbers[0]}`,
          parameters: { register_number: rollNumbers[0], registerNumber: rollNumbers[0], identifier: rollNumbers[0] }
        };
      }
      return {
        intent: 'VIEW_RESULTS',
        explanation: `View test results for roll number ${rollNumbers[0]}`,
        parameters: { roll_number: rollNumbers[0], rollNumber: rollNumbers[0], search: rollNumbers[0], identifier: rollNumbers[0] }
      };
    }

    if (/analyze|analysis|performance|weak question|hardest|average|highest|lowest/i.test(msg)) {
      if (/weak|hardest|wrong/i.test(msg)) {
        return {
          intent: 'QUESTION_PERFORMANCE_ANALYSIS',
          explanation: 'Identify difficult questions with high error rates',
          parameters: {}
        };
      }
      let targetTitle = null;
      if (msg.includes('aptitude test 1') || msg.includes('aptitude 1')) targetTitle = 'Aptitude Test 1';
      else if (msg.includes('placement test 1') || msg.includes('placement 1')) targetTitle = 'Placement Test 1';
      
      return {
        intent: 'ANALYZE_RESULTS',
        explanation: `Perform result evaluation and batch analytics for ${targetTitle || 'assessment'}`,
        parameters: { assessment_title: targetTitle, assessmentTitle: targetTitle, title: targetTitle }
      };
    }

    return {
      intent: 'VIEW_RESULTS',
      explanation: 'View candidate assessment results',
      parameters: {}
    };
  }

  // 6. Live Monitoring & Telemetry
  if (/who is currently writing|currently writing|active student|live monitoring|live exam/i.test(msg)) {
    return {
      intent: 'VIEW_LIVE_MONITORING',
      explanation: 'Retrieve live exam monitoring feed and active sessions',
      parameters: {}
    };
  }

  // 7. Student Search & Candidate Counts (e.g. "Find roll number 23ADS001", "Show CSE third year students", "evlo students")
  if (/student|candidate|roll number/i.test(msg)) {
    if (rollNumbers.length > 0) {
      return {
        intent: 'SEARCH_CANDIDATE',
        explanation: `Find student with roll number ${rollNumbers[0]}`,
        parameters: { register_number: rollNumbers[0] }
      };
    }

    let dept = null;
    let yr = null;
    if (msg.includes('ai')) dept = 'AI & Data Science';
    else if (msg.includes('cse') || msg.includes('computer')) dept = 'CSE';
    else if (msg.includes('ece')) dept = 'ECE';

    if (msg.includes('third year') || msg.includes('3rd year') || msg.includes('year 3')) yr = '3';
    else if (msg.includes('1st year') || msg.includes('first year')) yr = '1';
    else if (msg.includes('2nd year') || msg.includes('second year')) yr = '2';
    else if (msg.includes('4th year') || msg.includes('final year')) yr = '4';

    if (/how many|count|evlo/i.test(msg)) {
      return {
        intent: 'COUNT_CANDIDATES',
        explanation: 'Count registered student candidates',
        parameters: { department: dept, year: yr }
      };
    }

    return {
      intent: 'LIST_CANDIDATES',
      explanation: 'List matching student candidates',
      parameters: { department: dept, year: yr }
    };
  }

  // 8. Question Bank Search & Duplicates (e.g. "Show 20 aptitude questions", "Find duplicate questions")
  if (/question/i.test(msg)) {
    if (/duplicate|dup/i.test(msg)) {
      return {
        intent: 'FIND_DUPLICATES',
        explanation: 'Scan Question Bank for duplicate questions',
        parameters: {}
      };
    }
    if (/how many|count|available/i.test(msg)) {
      return {
        intent: 'COUNT_QUESTIONS',
        explanation: 'Count active questions in Question Bank',
        parameters: { category: msg.includes('verbal') ? 'VERBAL' : (msg.includes('aptitude') ? 'APTITUDE' : undefined) }
      };
    }
    return {
      intent: 'SEARCH_QUESTION_BANK',
      explanation: 'Search and filter Question Bank',
      parameters: {
        category: msg.includes('verbal') ? 'VERBAL' : (msg.includes('aptitude') ? 'APTITUDE' : undefined),
        difficulty: msg.includes('hard') ? 'HARD' : (msg.includes('easy') ? 'EASY' : (msg.includes('medium') ? 'MEDIUM' : undefined)),
        search: msg.includes('profit') ? 'profit' : (msg.includes('percentage') ? 'percentage' : undefined)
      }
    };
  }

  // 9. Dashboard Overview
  if (/dashboard|statistics|overview|summary/i.test(msg)) {
    return {
      intent: 'VIEW_DASHBOARD',
      explanation: 'View platform dashboard metrics and statistics',
      parameters: {}
    };
  }

  // 10. Help & Guidance
  if (/help|copilot|how do i|guide|what can you do|features|vanakkam/i.test(msg)) {
    return {
      intent: 'ADMIN_HELP',
      explanation: 'Skill AI Admin Copilot Guidance and Help',
      parameters: {}
    };
  }

  return {
    intent: 'UNKNOWN',
    explanation: 'Could not determine exact action from prompt',
    needsMoreInfo: true,
    followUpQuestion: 'Could you please specify which Admin action or tool you would like to run?'
  };
}

async function extractIntentFromUserRequest({ userMessage, fileContext = null, conversationContext = [] }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'YOUR_NEW_GEMINI_API_KEY' || apiKey.startsWith('gen-lang-client')) {
    return fallbackRuleIntentParser(userMessage);
  }

  try {
    let rawJson = '';
    try {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${INTENT_SYSTEM_PROMPT}\n\n${historyPrompt}${filePrompt}User Admin Message / Command:\n"${userMessage}"\n\nRespond ONLY in valid raw JSON matching the required schema:`,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });
      if (response && response.text) {
        rawJson = response.text;
      }
    } catch (sdkError) {
      const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const restRes = await axios.post(restUrl, {
        contents: [{ parts: [{ text: `${INTENT_SYSTEM_PROMPT}\n\n${historyPrompt}${filePrompt}User Admin Message / Command:\n"${userMessage}"\n\nRespond ONLY in valid raw JSON matching the required schema:` }] }],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      }, { timeout: 25000 });

      if (restRes.data && restRes.data.candidates && restRes.data.candidates[0]?.content?.parts[0]?.text) {
        rawJson = restRes.data.candidates[0].content.parts[0].text;
      }
    }

    if (rawJson) {
      const cleanJson = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && parsed.intent) {
        return parsed;
      }
    }
    return fallbackRuleIntentParser(userMessage);
  } catch (err) {
    console.warn('Gemini intent extraction error, using deterministic fallback parser:', err.message);
    return fallbackRuleIntentParser(userMessage);
  }
}

module.exports = {
  extractIntentFromUserRequest,
  fallbackRuleIntentParser
};
