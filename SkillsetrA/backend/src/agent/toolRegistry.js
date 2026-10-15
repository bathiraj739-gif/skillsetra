const pool = require('../config/db');
const questionService = require('../services/questionService');
const geminiQuestionService = require('../services/geminiQuestionService');
const webImportService = require('../services/webImportService');
const assessmentService = require('../services/assessmentService');
const assignmentService = require('../services/assignmentService');
const resultService = require('../services/resultService');
const dashboardService = require('../services/dashboardService');
const authService = require('../services/authService');

/**
 * SkillsetrA Agent Tool Registry
 * Strictly controls all available operational tools for the AI Agent.
 * Every tool maps directly to existing secure backend services or parameterized PostgreSQL queries.
 */
const TOOL_REGISTRY = {
  // ==========================================
  // 1. QUESTION BANK TOOLS
  // ==========================================

  COUNT_QUESTIONS: {
    name: 'COUNT_QUESTIONS',
    description: 'Count active questions in Question Bank filtered by category or difficulty.',
    requiresConfirmation: false,
    params: ['category', 'difficulty'],
    execute: async (params) => {
      const { category, difficulty } = params;
      let sql = 'SELECT COUNT(*) as count, category, difficulty FROM questions WHERE is_active = true';
      const values = [];
      const where = [];

      if (category) {
        where.push(`category = $${values.length + 1}`);
        values.push(category.toUpperCase());
      }
      if (difficulty) {
        where.push(`difficulty = $${values.length + 1}`);
        values.push(difficulty.toUpperCase());
      }

      if (where.length > 0) {
        sql += ' AND ' + where.join(' AND ');
      }
      sql += ' GROUP BY category, difficulty';

      const res = await pool.query(sql, values);
      const totalRes = await pool.query('SELECT COUNT(*) FROM questions WHERE is_active = true');
      return {
        totalQuestions: parseInt(totalRes.rows[0].count, 10),
        breakdown: res.rows.map(r => ({
          category: r.category,
          difficulty: r.difficulty,
          count: parseInt(r.count, 10)
        }))
      };
    }
  },

  SEARCH_QUESTION_BANK: {
    name: 'SEARCH_QUESTION_BANK',
    description: 'Search or filter questions in Question Bank by keyword, category, difficulty.',
    requiresConfirmation: false,
    params: ['search', 'category', 'difficulty', 'page', 'limit'],
    execute: async (params) => {
      const filters = {
        category: params.category ? params.category.toUpperCase() : undefined,
        difficulty: params.difficulty ? params.difficulty.toUpperCase() : undefined,
        search: params.search,
        page: params.page || 1,
        limit: params.limit || 15
      };
      return await questionService.getQuestions(filters);
    }
  },

  VIEW_QUESTION: {
    name: 'VIEW_QUESTION',
    description: 'Get details of a specific question by ID.',
    requiresConfirmation: false,
    params: ['id'],
    execute: async (params) => {
      const q = await questionService.getQuestionById(params.id);
      if (!q) throw new Error('Question not found');
      return q;
    }
  },

  CREATE_QUESTION: {
    name: 'CREATE_QUESTION',
    description: 'Create a new Aptitude or Verbal question in Question Bank.',
    requiresConfirmation: true,
    params: ['question_text', 'category', 'difficulty', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'marks'],
    preview: async (params) => {
      const dup = await pool.query('SELECT id FROM questions WHERE question_text = $1 AND is_active = true', [params.question_text]);
      return {
        actionSummary: `Create new ${(params.category || 'APTITUDE').toUpperCase()} question`,
        previewType: 'QUESTION_CREATION',
        isDuplicate: dup.rows.length > 0,
        questionText: params.question_text,
        category: (params.category || 'APTITUDE').toUpperCase(),
        difficulty: (params.difficulty || 'MEDIUM').toUpperCase(),
        correctOption: (params.correct_option || 'A').toUpperCase(),
        marks: Number(params.marks) || 1,
        options: {
          A: params.option_a,
          B: params.option_b,
          C: params.option_c,
          D: params.option_d
        }
      };
    },
    execute: async (params, userId) => {
      return await questionService.createQuestion({
        question_text: params.question_text,
        category: (params.category || 'APTITUDE').toUpperCase(),
        difficulty: (params.difficulty || 'MEDIUM').toUpperCase(),
        option_a: params.option_a,
        option_b: params.option_b,
        option_c: params.option_c,
        option_d: params.option_d,
        correct_option: (params.correct_option || 'A').toUpperCase(),
        marks: Number(params.marks) || 1
      }, userId);
    }
  },

  GENERATE_QUESTIONS: {
    name: 'GENERATE_QUESTIONS',
    description: 'Generate multiple choice aptitude or verbal questions using AI.',
    requiresConfirmation: true,
    params: ['category', 'topic', 'difficulty', 'count', 'marks'],
    preview: async (params) => {
      const count = Math.min(Math.max(Number(params.count) || 10, 1), 50);
      const category = (params.category || 'APTITUDE').toUpperCase();
      const topic = params.topic || 'Percentage';
      const difficulty = (params.difficulty || 'MEDIUM').toUpperCase();
      const marks = Number(params.marks) || 1;

      // Pre-generate & validate questions for preview
      const generated = await geminiQuestionService.generateQuestionsFromGemini({
        category,
        topic,
        difficulty,
        count,
        marks
      });

      // Check duplicates against DB
      const checked = await webImportService.performDuplicateAndValidationCheck(generated.map(q => ({
        question_text: q.questionText,
        option_a: q.optionA,
        option_b: q.optionB,
        option_c: q.optionC,
        option_d: q.optionD,
        correct_option: q.correctOption,
        category: q.category || category,
        difficulty: q.difficulty || difficulty,
        marks: q.marks || marks
      })));

      return {
        actionSummary: `AI Generated ${generated.length} ${difficulty} ${category} questions on "${topic}"`,
        previewType: 'QUESTION_GENERATION',
        count: generated.length,
        category,
        topic,
        difficulty,
        marks,
        summary: {
          totalGenerated: generated.length,
          validCount: checked.valid.length,
          duplicatesCount: checked.duplicates.length,
          needsReviewCount: checked.needsReview.length
        },
        preparedQuestions: checked.valid,
        questions: checked.valid.map((q, idx) => ({
          index: idx + 1,
          questionText: q.question_text,
          optionA: q.option_a,
          optionB: q.option_b,
          optionC: q.option_c,
          optionD: q.option_d,
          correctOption: q.correct_option,
          difficulty: q.difficulty || difficulty,
          category: q.category || category,
          marks: q.marks || marks
        })),
        duplicates: checked.duplicates
      };
    },
    execute: async (params, userId) => {
      let questionsToSave = params.preparedQuestions;
      if (!questionsToSave || questionsToSave.length === 0) {
        const generated = await geminiQuestionService.generateQuestionsFromGemini({
          category: (params.category || 'APTITUDE').toUpperCase(),
          topic: params.topic || 'General Placement',
          difficulty: (params.difficulty || 'MEDIUM').toUpperCase(),
          count: Math.min(Math.max(Number(params.count) || 10, 1), 50),
          marks: Number(params.marks) || 1
        });
        questionsToSave = generated.map(q => ({
          question_text: q.questionText,
          option_a: q.optionA,
          option_b: q.optionB,
          option_c: q.optionC,
          option_d: q.optionD,
          correct_option: q.correctOption,
          category: q.category,
          difficulty: q.difficulty,
          marks: q.marks
        }));
      }

      const createdQuestions = [];
      let skippedDuplicates = 0;

      for (const q of questionsToSave) {
        try {
          const created = await questionService.createQuestion({
            question_text: q.question_text || q.questionText,
            category: q.category,
            difficulty: q.difficulty,
            option_a: q.option_a || q.optionA,
            option_b: q.option_b || q.optionB,
            option_c: q.option_c || q.optionC,
            option_d: q.option_d || q.optionD,
            correct_option: q.correct_option || q.correctOption,
            marks: q.marks
          }, userId);
          createdQuestions.push(created);
        } catch (err) {
          if (err.message === 'DUPLICATE_QUESTION') {
            skippedDuplicates++;
          } else {
            throw err;
          }
        }
      }

      return {
        totalGenerated: questionsToSave.length,
        totalSaved: createdQuestions.length,
        skippedDuplicates,
        savedQuestions: createdQuestions
      };
    }
  },

  FIND_DUPLICATES: {
    name: 'FIND_DUPLICATES',
    description: 'Scan Question Bank for duplicate questions.',
    requiresConfirmation: false,
    params: [],
    execute: async () => {
      const res = await pool.query(`
        SELECT question_text, COUNT(*) as count 
        FROM questions 
        WHERE is_active = true 
        GROUP BY question_text 
        HAVING COUNT(*) > 1
      `);
      return {
        duplicateGroupsCount: res.rows.length,
        duplicates: res.rows.map(r => ({
          questionText: r.question_text,
          occurrences: parseInt(r.count, 10)
        }))
      };
    }
  },

  UPDATE_QUESTION: {
    name: 'UPDATE_QUESTION',
    description: 'Update an existing question in Question Bank.',
    requiresConfirmation: true,
    params: ['id', 'question_text', 'category', 'difficulty', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'marks'],
    preview: async (params) => {
      const current = await questionService.getQuestionById(params.id);
      if (!current) throw new Error('Question not found');
      return {
        actionSummary: `Update Question ID: ${params.id}`,
        existingText: current.question_text,
        newText: params.question_text || current.question_text
      };
    },
    execute: async (params, userId) => {
      return await questionService.updateQuestion(params.id, params, userId);
    }
  },

  DELETE_QUESTION: {
    name: 'DELETE_QUESTION',
    description: 'Soft-delete a question from Question Bank.',
    requiresConfirmation: true,
    params: ['id'],
    preview: async (params) => {
      const current = await questionService.getQuestionById(params.id);
      if (!current) throw new Error('Question not found');
      return {
        actionSummary: `Delete Question "${current.question_text.slice(0, 50)}..."`,
        questionId: params.id,
        questionText: current.question_text
      };
    },
    execute: async (params) => {
      return await questionService.deleteQuestion(params.id);
    }
  },

  IMPORT_QUESTIONS: {
    name: 'IMPORT_QUESTIONS',
    description: 'Save a batch of validated questions to Question Bank.',
    requiresConfirmation: true,
    params: ['questions'],
    preview: async (params) => {
      const list = params.questions || [];
      return {
        actionSummary: `Import and save ${list.length} questions to Question Bank`,
        previewType: 'QUESTION_IMPORT',
        count: list.length,
        sample: list.slice(0, 5)
      };
    },
    execute: async (params, userId) => {
      const list = params.questions || [];
      const saved = [];
      let duplicates = 0;
      for (const q of list) {
        try {
          const created = await questionService.createQuestion({
            question_text: q.question_text || q.questionText,
            category: (q.category || 'APTITUDE').toUpperCase(),
            difficulty: (q.difficulty || 'MEDIUM').toUpperCase(),
            option_a: q.option_a || q.optionA,
            option_b: q.option_b || q.optionB,
            option_c: q.option_c || q.optionC,
            option_d: q.option_d || q.optionD,
            correct_option: (q.correct_option || q.correctOption || 'A').toUpperCase(),
            marks: Number(q.marks) || 1
          }, userId);
          saved.push(created);
        } catch (e) {
          duplicates++;
        }
      }
      return {
        totalReceived: list.length,
        totalSaved: saved.length,
        skippedDuplicates: duplicates,
        savedQuestions: saved
      };
    }
  },

  // ==========================================
  // 2. WEB & ONLINE IMPORT TOOLS
  // ==========================================

  WEB_SEARCH_IMPORT: {
    name: 'WEB_SEARCH_IMPORT',
    description: 'Search online sources for aptitude or verbal questions and prepare preview.',
    requiresConfirmation: true,
    params: ['query', 'count', 'category', 'difficulty'],
    preview: async (params) => {
      const query = params.query || 'Aptitude Percentage Questions';
      const count = Number(params.count) || 20;
      const category = (params.category || 'APTITUDE').toUpperCase();
      const difficulty = (params.difficulty || 'MEDIUM').toUpperCase();

      const result = await webImportService.searchWebQuestions({ query, count, category, difficulty });

      return {
        actionSummary: `Online Search: ${result.summary.validCount} valid questions found for "${query}"`,
        previewType: 'WEB_IMPORT',
        source: result.source,
        query,
        summary: result.summary,
        preparedQuestions: result.validQuestions,
        questions: result.validQuestions.map((q, i) => ({ index: i + 1, ...q })),
        needsReview: result.needsReviewQuestions,
        duplicates: result.duplicates
      };
    },
    execute: async (params, userId) => {
      const list = params.preparedQuestions || [];
      const saved = [];
      let skippedDuplicates = 0;
      for (const q of list) {
        try {
          const created = await questionService.createQuestion(q, userId);
          saved.push(created);
        } catch (e) {
          skippedDuplicates++;
        }
      }
      return {
        totalImported: saved.length,
        skippedDuplicates,
        savedQuestions: saved
      };
    }
  },

  EXTRACT_URL_QUESTIONS: {
    name: 'EXTRACT_URL_QUESTIONS',
    description: 'Fetch and extract questions from a public webpage URL safely.',
    requiresConfirmation: true,
    params: ['url', 'category', 'difficulty', 'count'],
    preview: async (params) => {
      const url = params.url;
      if (!url) throw new Error('URL parameter is required');

      const result = await webImportService.importFromUrl({
        url,
        category: (params.category || 'APTITUDE').toUpperCase(),
        difficulty: (params.difficulty || 'MEDIUM').toUpperCase(),
        count: Number(params.count) || 20
      });

      return {
        actionSummary: `Extracted ${result.summary.validCount} questions from ${url}`,
        previewType: 'WEB_IMPORT',
        source: url,
        summary: result.summary,
        preparedQuestions: result.validQuestions,
        questions: result.validQuestions.map((q, i) => ({ index: i + 1, ...q })),
        needsReview: result.needsReviewQuestions,
        duplicates: result.duplicates
      };
    },
    execute: async (params, userId) => {
      const list = params.preparedQuestions || [];
      const saved = [];
      let skipped = 0;
      for (const q of list) {
        try {
          const c = await questionService.createQuestion(q, userId);
          saved.push(c);
        } catch {
          skipped++;
        }
      }
      return { totalImported: saved.length, skipped, savedQuestions: saved };
    }
  },

  PARSE_PASTED_QUESTIONS: {
    name: 'PARSE_PASTED_QUESTIONS',
    description: 'Parse pasted question text from ChatGPT, Notepad, or website clipboard.',
    requiresConfirmation: true,
    params: ['text', 'category', 'difficulty', 'count'],
    preview: async (params) => {
      const text = params.text;
      if (!text) throw new Error('Text content is required');

      const result = await webImportService.importFromPastedText({
        text,
        category: (params.category || 'APTITUDE').toUpperCase(),
        difficulty: (params.difficulty || 'MEDIUM').toUpperCase(),
        count: Number(params.count) || 30
      });

      return {
        actionSummary: `Parsed ${result.summary.validCount} valid questions from pasted text`,
        previewType: 'WEB_IMPORT',
        summary: result.summary,
        preparedQuestions: result.validQuestions,
        questions: result.validQuestions.map((q, i) => ({ index: i + 1, ...q })),
        needsReview: result.needsReviewQuestions,
        duplicates: result.duplicates
      };
    },
    execute: async (params, userId) => {
      const list = params.preparedQuestions || [];
      const saved = [];
      let skipped = 0;
      for (const q of list) {
        try {
          const c = await questionService.createQuestion(q, userId);
          saved.push(c);
        } catch {
          skipped++;
        }
      }
      return { totalImported: saved.length, skipped, savedQuestions: saved };
    }
  },

  // ==========================================
  // 3. CANDIDATE / STUDENT TOOLS
  // ==========================================

  LIST_CANDIDATES: {
    name: 'LIST_CANDIDATES',
    description: 'List and filter student candidates by department, year, section, or search term.',
    requiresConfirmation: false,
    params: ['department', 'year', 'section', 'search'],
    execute: async (params) => {
      let sql = `
        SELECT 
          s.id, s.user_id, s.register_number, s.full_name, s.email, 
          s.department, s.year, s.section, s.phone, u.is_active, s.created_at
        FROM students s
        JOIN users u ON s.user_id = u.id
      `;
      const where = [];
      const values = [];

      if (params.department) {
        where.push(`s.department ILIKE $${values.length + 1}`);
        values.push(`%${params.department}%`);
      }
      if (params.year != null && params.year !== '') {
        where.push(`s.year = $${values.length + 1}`);
        values.push(String(params.year));
      }
      if (params.section) {
        where.push(`s.section ILIKE $${values.length + 1}`);
        values.push(`%${params.section}%`);
      }
      if (params.search) {
        where.push(`(s.full_name ILIKE $${values.length + 1} OR s.register_number ILIKE $${values.length + 1} OR s.email ILIKE $${values.length + 1})`);
        values.push(`%${params.search}%`);
      }

      if (where.length > 0) {
        sql += ' WHERE ' + where.join(' AND ');
      }
      sql += ' ORDER BY s.register_number ASC LIMIT 100';

      const res = await pool.query(sql, values);
      return {
        totalFound: res.rows.length,
        candidates: res.rows
      };
    }
  },

  SEARCH_CANDIDATE: {
    name: 'SEARCH_CANDIDATE',
    description: 'Find candidate by register number, name, or ID.',
    requiresConfirmation: false,
    params: ['register_number', 'name', 'id'],
    execute: async (params) => {
      const searchTerm = params.register_number || params.name || params.id;
      if (!searchTerm) throw new Error('Search parameter required');

      const res = await pool.query(`
        SELECT s.id, s.user_id, s.register_number, s.full_name, s.email, s.department, s.year, s.section, s.phone, u.is_active
        FROM students s
        JOIN users u ON s.user_id = u.id
        WHERE s.register_number ILIKE $1 OR s.full_name ILIKE $1 OR s.id::text = $2 OR s.user_id::text = $2
      `, [`%${searchTerm}%`, searchTerm.length === 36 ? searchTerm : '00000000-0000-0000-0000-000000000000']);

      if (res.rows.length === 0) {
        return {
          foundCount: 0,
          message: `Roll number / Candidate "${searchTerm}" was not found in the platform.`
        };
      }

      return {
        foundCount: res.rows.length,
        candidates: res.rows
      };
    }
  },

  COUNT_CANDIDATES: {
    name: 'COUNT_CANDIDATES',
    description: 'Count registered candidates filtered by department or year.',
    requiresConfirmation: false,
    params: ['department', 'year'],
    execute: async (params) => {
      let sql = 'SELECT COUNT(*) as total FROM students';
      const where = [];
      const values = [];

      if (params.department) {
        where.push(`department ILIKE $${values.length + 1}`);
        values.push(`%${params.department}%`);
      }
      if (params.year != null && params.year !== '') {
        where.push(`year = $${values.length + 1}`);
        values.push(String(params.year));
      }
      if (where.length > 0) {
        sql += ' WHERE ' + where.join(' AND ');
      }

      const res = await pool.query(sql, values);
      return {
        totalCandidates: parseInt(res.rows[0].total, 10),
        filters: params
      };
    }
  },

  CREATE_CANDIDATE: {
    name: 'CREATE_CANDIDATE',
    description: 'Register a single student candidate account.',
    requiresConfirmation: true,
    params: ['register_number', 'full_name', 'username', 'password', 'email', 'department', 'year', 'section', 'phone'],
    preview: async (params) => {
      return {
        actionSummary: `Register candidate ${params.full_name || ''} (${params.register_number || ''})`,
        registerNumber: params.register_number,
        fullName: params.full_name,
        department: params.department,
        year: params.year
      };
    },
    execute: async (params) => {
      const regNo = (params.register_number || '').trim();
      const fullName = (params.full_name || '').trim();
      const username = (params.username || regNo).trim();
      const password = (params.password || 'Student@123').trim();

      const result = await authService.createStudentAccount({
        username,
        password,
        full_name: fullName,
        register_number: regNo,
        email: params.email || null,
        department: params.department || null,
        year: params.year ? String(params.year) : null,
        section: params.section || null,
        phone: params.phone || null
      });

      return {
        success: true,
        studentId: result.student.id,
        registerNumber: result.student.register_number,
        fullName: result.student.full_name
      };
    }
  },

  // ==========================================
  // 4. ASSESSMENT TOOLS
  // ==========================================

  VIEW_ASSESSMENT: {
    name: 'VIEW_ASSESSMENT',
    description: 'Get detailed information about an assessment including attached questions.',
    requiresConfirmation: false,
    params: ['id', 'title'],
    execute: async (params) => {
      let assId = params.id;
      if (!assId && params.title) {
        const searchRes = await pool.query('SELECT id FROM assessments WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 1', [`%${params.title}%`]);
        if (searchRes.rows.length > 0) {
          assId = searchRes.rows[0].id;
        }
      }
      if (!assId) throw new Error('Assessment ID or Title is required');
      const ass = await assessmentService.getAssessmentById(assId);
      if (!ass) throw new Error('Assessment not found');
      return ass;
    }
  },

  SEARCH_ASSESSMENTS: {
    name: 'SEARCH_ASSESSMENTS',
    description: 'Search assessments by status or title keyword.',
    requiresConfirmation: false,
    params: ['status', 'search', 'page', 'limit'],
    execute: async (params) => {
      return await assessmentService.getAssessments({
        status: params.status ? params.status.toUpperCase() : undefined,
        search: params.search,
        page: params.page || 1,
        limit: params.limit || 20
      });
    }
  },

  COUNT_ASSESSMENTS: {
    name: 'COUNT_ASSESSMENTS',
    description: 'Count total assessments grouped by status.',
    requiresConfirmation: false,
    params: [],
    execute: async () => {
      const res = await pool.query(`
        SELECT status, COUNT(*) as count FROM assessments GROUP BY status
      `);
      const totalRes = await pool.query('SELECT COUNT(*) FROM assessments');
      return {
        totalAssessments: parseInt(totalRes.rows[0].count, 10),
        breakdown: res.rows.map(r => ({ status: r.status, count: parseInt(r.count, 10) }))
      };
    }
  },

  CREATE_ASSESSMENT: {
    name: 'CREATE_ASSESSMENT',
    description: 'Create a new assessment with title, duration, and question count referencing existing Question Bank.',
    requiresConfirmation: true,
    params: ['title', 'description', 'duration_minutes', 'question_count', 'category', 'difficulty', 'question_ids'],
    preview: async (params) => {
      let questionIds = params.question_ids || params.questionIds || [];
      const count = Number(params.question_count || params.questionCount) || 30;
      const durationMinutes = Number(params.duration_minutes || params.durationMinutes) || 40;
      
      let questionsSample = [];
      if (!questionIds || questionIds.length === 0) {
        let sql = 'SELECT id, question_text, category, difficulty, marks FROM questions WHERE is_active = true';
        const values = [];
        if (params.category) {
          sql += ` AND category = $${values.length + 1}`;
          values.push(params.category.toUpperCase());
        }
        if (params.difficulty) {
          sql += ` AND difficulty = $${values.length + 1}`;
          values.push(params.difficulty.toUpperCase());
        }
        sql += ` ORDER BY RANDOM() LIMIT $${values.length + 1}`;
        values.push(count);

        const qRes = await pool.query(sql, values);
        questionIds = qRes.rows.map(r => r.id);
        questionsSample = qRes.rows.slice(0, 10);
      }

      const totalMarks = questionsSample.reduce((acc, q) => acc + (q.marks || 1), 0) || questionIds.length;

      return {
        actionSummary: `Create assessment "${params.title || 'Placement Assessment'}" (${durationMinutes} mins, ${questionIds.length} questions)`,
        previewType: 'ASSESSMENT_CREATION',
        title: params.title || 'Placement Assessment',
        description: params.description || 'Generated Placement Assessment',
        category: (params.category || 'APTITUDE').toUpperCase(),
        durationMinutes,
        questionCount: questionIds.length,
        totalMarks,
        status: 'Draft',
        questionIds,
        questionsSample: questionsSample.map((q, i) => ({ index: i + 1, text: q.question_text, marks: q.marks || 1 }))
      };
    },
    execute: async (params, userId) => {
      let questionIds = params.question_ids || params.questionIds || [];
      const count = Number(params.question_count || params.questionCount) || 30;
      const durationMinutes = Number(params.duration_minutes || params.durationMinutes) || 40;

      if (!questionIds || questionIds.length === 0) {
        let sql = 'SELECT id FROM questions WHERE is_active = true';
        const values = [];
        if (params.category) {
          sql += ` AND category = $${values.length + 1}`;
          values.push(params.category.toUpperCase());
        }
        if (params.difficulty) {
          sql += ` AND difficulty = $${values.length + 1}`;
          values.push(params.difficulty.toUpperCase());
        }
        sql += ` ORDER BY RANDOM() LIMIT $${values.length + 1}`;
        values.push(count);

        const qRes = await pool.query(sql, values);
        questionIds = qRes.rows.map(r => r.id);
      }

      if (questionIds.length === 0) {
        throw new Error('No active questions found matching the requested criteria in Question Bank.');
      }

      return await assessmentService.createAssessment({
        title: params.title || 'Placement Assessment',
        description: params.description || 'Generated Aptitude & Verbal Assessment',
        durationMinutes,
        questionIds
      }, userId);
    }
  },

  PUBLISH_ASSESSMENT: {
    name: 'PUBLISH_ASSESSMENT',
    description: 'Publish a draft assessment to make it available for assignments.',
    requiresConfirmation: true,
    params: ['id', 'title'],
    preview: async (params) => {
      let id = params.id;
      if (!id && params.title) {
        const search = await pool.query('SELECT id, title, status FROM assessments WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 1', [`%${params.title}%`]);
        if (search.rows.length > 0) id = search.rows[0].id;
      }
      if (!id) throw new Error('Assessment ID or Title is required');

      const ass = await assessmentService.getAssessmentById(id);
      if (!ass) throw new Error('Assessment not found');

      return {
        actionSummary: `Publish assessment "${ass.title}"`,
        assessmentId: ass.id,
        title: ass.title,
        questionCount: ass.question_count,
        totalMarks: ass.total_marks,
        currentStatus: ass.status
      };
    },
    execute: async (params, userId) => {
      let id = params.id;
      if (!id && params.title) {
        const search = await pool.query('SELECT id FROM assessments WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 1', [`%${params.title}%`]);
        if (search.rows.length > 0) id = search.rows[0].id;
      }
      return await assessmentService.publishAssessment(id, userId);
    }
  },

  CLOSE_ASSESSMENT: {
    name: 'CLOSE_ASSESSMENT',
    description: 'Close a published assessment to stop further attempts.',
    requiresConfirmation: true,
    params: ['id', 'title'],
    preview: async (params) => {
      let id = params.id;
      if (!id && params.title) {
        const search = await pool.query('SELECT id, title FROM assessments WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 1', [`%${params.title}%`]);
        if (search.rows.length > 0) id = search.rows[0].id;
      }
      if (!id) throw new Error('Assessment ID or Title is required');

      const ass = await assessmentService.getAssessmentById(id);
      if (!ass) throw new Error('Assessment not found');

      return {
        actionSummary: `Close assessment "${ass.title}"`,
        assessmentId: ass.id,
        title: ass.title,
        currentStatus: ass.status
      };
    },
    execute: async (params, userId) => {
      let id = params.id;
      if (!id && params.title) {
        const search = await pool.query('SELECT id FROM assessments WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 1', [`%${params.title}%`]);
        if (search.rows.length > 0) id = search.rows[0].id;
      }
      return await assessmentService.closeAssessment(id, userId);
    }
  },

  DELETE_ASSESSMENT: {
    name: 'DELETE_ASSESSMENT',
    description: 'Delete a draft unused assessment.',
    requiresConfirmation: true,
    params: ['id', 'title'],
    preview: async (params) => {
      let id = params.id;
      if (!id && params.title) {
        const search = await pool.query('SELECT id, title FROM assessments WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 1', [`%${params.title}%`]);
        if (search.rows.length > 0) id = search.rows[0].id;
      }
      if (!id) throw new Error('Assessment ID or Title required');

      const ass = await assessmentService.getAssessmentById(id);
      if (!ass) throw new Error('Assessment not found');

      return {
        actionSummary: `DESTRUCTIVE: Delete assessment "${ass.title}"`,
        assessmentId: ass.id,
        title: ass.title
      };
    },
    execute: async (params, userId) => {
      let id = params.id;
      if (!id && params.title) {
        const search = await pool.query('SELECT id FROM assessments WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 1', [`%${params.title}%`]);
        if (search.rows.length > 0) id = search.rows[0].id;
      }
      return await assessmentService.deleteAssessment(id, userId);
    }
  },

  // ==========================================
  // 5. ASSIGNMENT TOOLS
  // ==========================================

  BULK_ASSIGN_ASSESSMENT: {
    name: 'BULK_ASSIGN_ASSESSMENT',
    description: 'Assign an assessment to single/multiple roll numbers or target department/year.',
    requiresConfirmation: true,
    params: ['assessment_id', 'assessment_title', 'roll_numbers', 'department', 'year', 'section', 'due_at'],
    preview: async (params) => {
      let assId = params.assessment_id;
      let assTitle = params.assessment_title;

      if (!assId) {
        let assQuery = 'SELECT id, title, status FROM assessments';
        if (assTitle) {
          const assRes = await pool.query(`${assQuery} WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 1`, [`%${assTitle}%`]);
          if (assRes.rows.length > 0) {
            assId = assRes.rows[0].id;
            assTitle = assRes.rows[0].title;
          }
        }
        if (!assId) {
          const assRes = await pool.query(`${assQuery} WHERE status = 'PUBLISHED' ORDER BY created_at DESC LIMIT 1`);
          if (assRes.rows.length > 0) {
            assId = assRes.rows[0].id;
            assTitle = assRes.rows[0].title;
          } else {
            const anyAss = await pool.query(`${assQuery} ORDER BY created_at DESC LIMIT 1`);
            if (anyAss.rows.length > 0) {
              assId = anyAss.rows[0].id;
              assTitle = anyAss.rows[0].title;
            }
          }
        }
      }

      if (!assId) {
        throw new Error('No assessment available to assign. Please create or publish an assessment first.');
      }

      let stuRes;
      let rollNumbersList = [];

      if (params.roll_numbers) {
        if (Array.isArray(params.roll_numbers)) {
          rollNumbersList = params.roll_numbers;
        } else if (typeof params.roll_numbers === 'string') {
          rollNumbersList = params.roll_numbers.split(/[\s,;]+/).filter(Boolean);
        }
      }

      if (rollNumbersList.length > 0) {
        // Specific Roll Numbers
        stuRes = await pool.query(
          'SELECT id, full_name, register_number, department, year FROM students WHERE register_number = ANY($1::text[])',
          [rollNumbersList]
        );

        if (stuRes.rows.length === 0) {
          throw new Error(`Roll number(s) ${rollNumbersList.join(', ')} were not found in the database.`);
        }
      } else {
        // Department / Year cohort filter
        let stuSql = 'SELECT id, full_name, register_number, department, year FROM students';
        const where = [];
        const values = [];

        if (params.department) {
          where.push(`department ILIKE $${values.length + 1}`);
          values.push(`%${params.department}%`);
        }
        if (params.year != null && params.year !== '') {
          where.push(`year = $${values.length + 1}`);
          values.push(String(params.year));
        }
        if (params.section) {
          where.push(`section ILIKE $${values.length + 1}`);
          values.push(`%${params.section}%`);
        }

        if (where.length > 0) {
          stuSql += ' WHERE ' + where.join(' AND ');
        }

        stuRes = await pool.query(stuSql, values);
        if (stuRes.rows.length === 0) {
          const allStu = await pool.query('SELECT id, full_name, register_number, department, year FROM students LIMIT 100');
          stuRes = allStu;
        }
      }

      const studentIds = stuRes.rows.map(r => r.id);

      // Check existing assignments
      const existingRes = studentIds.length > 0 ? await pool.query(
        `SELECT student_id FROM assessment_assignments WHERE assessment_id = $1 AND student_id = ANY($2::uuid[])`,
        [assId, studentIds]
      ) : { rows: [] };
      const existingIds = new Set(existingRes.rows.map(r => r.student_id));
      const newAssignmentsCount = studentIds.length - existingIds.size;

      return {
        actionSummary: rollNumbersList.length > 0
          ? `Assign "${assTitle}" to roll number(s): ${stuRes.rows.map(s => s.register_number).join(', ')}`
          : `Assign "${assTitle}" to ${params.department || 'all'} ${params.year ? params.year + ' year' : ''} students`,
        previewType: 'ASSIGNMENT',
        assessmentId: assId,
        assessmentTitle: assTitle,
        targetDepartment: params.department || null,
        targetYear: params.year || null,
        studentRollNumbers: rollNumbersList,
        totalMatchingStudents: studentIds.length,
        alreadyAssignedCount: existingIds.size,
        newAssignmentsCount,
        studentIds,
        dueAt: params.due_at || 'Standard Schedule',
        students: stuRes.rows.map(s => ({
          name: s.full_name,
          registerNumber: s.register_number,
          department: s.department,
          year: s.year
        }))
      };
    },
    execute: async (params, userId) => {
      let assId = params.assessment_id || params.assessmentId;
      if (!assId && params.assessment_title) {
        const assRes = await pool.query('SELECT id FROM assessments WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 1', [`%${params.assessment_title}%`]);
        if (assRes.rows.length > 0) assId = assRes.rows[0].id;
      }
      if (!assId) {
        const assRes = await pool.query("SELECT id FROM assessments WHERE status = 'PUBLISHED' ORDER BY created_at DESC LIMIT 1");
        if (assRes.rows.length > 0) assId = assRes.rows[0].id;
      }

      const studentIds = params.studentIds || params.student_ids;
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        throw new Error('No students selected for assignment.');
      }

      // If assessment is DRAFT, publish it so it can be assigned seamlessly
      const statusCheck = await pool.query('SELECT status FROM assessments WHERE id = $1', [assId]);
      if (statusCheck.rows.length > 0 && statusCheck.rows[0].status === 'DRAFT') {
        await assessmentService.publishAssessment(assId, userId);
      }

      const result = await assignmentService.createAssignments({
        assessmentId: assId,
        studentIds,
        dueAt: params.dueAt || params.due_at || null
      }, userId);

      return {
        newlyAssignedCount: result.assigned.length,
        alreadyAssignedCount: result.alreadyAssigned.length,
        totalTargeted: studentIds.length
      };
    }
  },

  VIEW_ASSIGNMENTS: {
    name: 'VIEW_ASSIGNMENTS',
    description: 'View assessment assignments with candidate attempt status.',
    requiresConfirmation: false,
    params: ['assessment_id', 'status', 'search', 'page', 'limit'],
    execute: async (params) => {
      return await assignmentService.getAssignments({
        assessmentId: params.assessment_id,
        status: params.status ? params.status.toUpperCase() : undefined,
        search: params.search,
        page: params.page || 1,
        limit: params.limit || 20
      });
    }
  },

  // ==========================================
  // 6. RESULT & ANALYTICS TOOLS
  // ==========================================

  VIEW_RESULTS: {
    name: 'VIEW_RESULTS',
    description: 'View candidate assessment results and scores from real PostgreSQL data.',
    requiresConfirmation: false,
    params: ['assessment_id', 'student_id', 'search', 'roll_number', 'page', 'limit'],
    execute: async (params) => {
      const searchTerm = params.roll_number || params.search;
      return await resultService.getResults({
        assessmentId: params.assessment_id,
        studentId: params.student_id,
        search: searchTerm,
        page: params.page || 1,
        limit: params.limit || 20
      });
    }
  },

  ANALYZE_RESULTS: {
    name: 'ANALYZE_RESULTS',
    description: 'Perform analytical breakdown on assessment results using PostgreSQL data.',
    requiresConfirmation: false,
    params: ['assessment_id', 'assessment_title'],
    execute: async (params) => {
      let assId = params.assessment_id || params.assessmentId;
      const targetTitle = params.assessment_title || params.assessmentTitle || params.title;

      if (!assId && targetTitle) {
        // Search by title
        const r = await pool.query('SELECT id, title FROM assessments WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 1', [`%${targetTitle}%`]);
        if (r.rows.length > 0) assId = r.rows[0].id;
      }

      if (!assId) {
        // Fallback to latest assessment
        const r = await pool.query('SELECT id, title FROM assessments ORDER BY created_at DESC LIMIT 1');
        if (r.rows.length > 0) assId = r.rows[0].id;
      }

      if (!assId) {
        return {
          title: targetTitle || 'Assessment Result Analysis',
          totalStudents: 0,
          completedCount: 0,
          averageScore: 0,
          passRate: 0,
          highestScore: 0,
          lowestScore: 0,
          message: 'No assessment records available for analysis yet.'
        };
      }

      const assRes = await pool.query('SELECT id, title, total_marks FROM assessments WHERE id = $1', [assId]);
      const assessment = assRes.rows[0];

      // Assignment status counts
      const assignCountsRes = await pool.query(`
        SELECT 
          COUNT(*) as total_assigned,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_count,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_count,
          COUNT(*) FILTER (WHERE status = 'ASSIGNED') as not_started_count
        FROM assessment_assignments
        WHERE assessment_id = $1
      `, [assId]);
      const ac = assignCountsRes.rows[0];

      // Results statistics
      const statsRes = await pool.query(`
        SELECT 
          COUNT(*) as total_results,
          COALESCE(AVG(score), 0) as avg_score,
          COALESCE(MAX(score), 0) as max_score,
          COALESCE(MIN(score), 0) as min_score,
          COALESCE(AVG(percentage), 0) as avg_percentage,
          COALESCE(SUM(correct_answers), 0) as total_correct,
          COALESCE(SUM(wrong_answers), 0) as total_wrong,
          COALESCE(SUM(unanswered), 0) as total_unanswered,
          COUNT(*) FILTER (WHERE percentage >= 50) as pass_count,
          COUNT(*) FILTER (WHERE percentage < 50) as fail_count
        FROM results
        WHERE assessment_id = $1
      `, [assId]);

      const s = statsRes.rows[0];
      const totalResults = parseInt(s.total_results, 10);

      // Question-level performance breakdown
      const qPerfRes = await pool.query(`
        SELECT 
          q.id as question_id,
          q.question_text,
          q.category,
          COUNT(ans.id) as times_answered,
          COUNT(ans.id) FILTER (WHERE ans.is_correct = true) as correct_count,
          COUNT(ans.id) FILTER (WHERE ans.is_correct = false) as wrong_count
        FROM assessment_questions aq
        JOIN questions q ON aq.question_id = q.id
        LEFT JOIN answers ans ON ans.question_id = q.id
        WHERE aq.assessment_id = $1
        GROUP BY q.id, q.question_text, q.category, aq.question_order
        ORDER BY wrong_count DESC, aq.question_order ASC
      `, [assId]);

      const questionPerformance = qPerfRes.rows.map(r => {
        const answered = parseInt(r.times_answered || 0, 10);
        const correct = parseInt(r.correct_count || 0, 10);
        const wrong = parseInt(r.wrong_count || 0, 10);
        const correctPct = answered > 0 ? parseFloat(((correct / answered) * 100).toFixed(1)) : 0;
        const wrongPct = answered > 0 ? parseFloat(((wrong / answered) * 100).toFixed(1)) : 0;

        return {
          questionId: r.question_id,
          questionText: r.question_text,
          category: r.category,
          timesAnswered: answered,
          correctCount: correct,
          wrongCount: wrong,
          correctPercentage: correctPct,
          wrongPercentage: wrongPct
        };
      });

      return {
        assessment: {
          id: assessment.id,
          title: assessment.title,
          totalMarks: assessment.total_marks
        },
        cohortMetrics: {
          assigned: parseInt(ac.total_assigned || 0, 10),
          completed: parseInt(ac.completed_count || totalResults, 10),
          inProgress: parseInt(ac.in_progress_count || 0, 10),
          notStarted: parseInt(ac.not_started_count || 0, 10)
        },
        scoreMetrics: {
          averageScore: parseFloat(parseFloat(s.avg_score).toFixed(2)),
          highestScore: parseFloat(s.max_score),
          lowestScore: parseFloat(s.min_score),
          averagePercentage: parseFloat(parseFloat(s.avg_percentage).toFixed(2)),
          totalCorrectAnswers: parseInt(s.total_correct, 10),
          totalWrongAnswers: parseInt(s.total_wrong, 10),
          totalUnanswered: parseInt(s.total_unanswered, 10),
          passedCount: parseInt(s.pass_count, 10),
          failedCount: parseInt(s.fail_count, 10),
          passRatePercentage: totalResults > 0 ? parseFloat(((parseInt(s.pass_count, 10) / totalResults) * 100).toFixed(1)) : 0
        },
        weakestQuestions: questionPerformance.slice(0, 5),
        questionPerformance
      };
    }
  },

  QUESTION_PERFORMANCE_ANALYSIS: {
    name: 'QUESTION_PERFORMANCE_ANALYSIS',
    description: 'Find questions with the highest error rate across assessments.',
    requiresConfirmation: false,
    params: ['assessment_id'],
    execute: async (params) => {
      let whereClause = '';
      const values = [];
      if (params.assessment_id) {
        whereClause = 'WHERE aq.assessment_id = $1';
        values.push(params.assessment_id);
      }

      const res = await pool.query(`
        SELECT 
          q.id, q.question_text, q.category, q.difficulty,
          COUNT(ans.id) as total_answers,
          COUNT(ans.id) FILTER (WHERE ans.is_correct = false) as wrong_answers,
          COUNT(ans.id) FILTER (WHERE ans.is_correct = true) as correct_answers
        FROM questions q
        JOIN answers ans ON q.id = ans.question_id
        ${whereClause}
        GROUP BY q.id, q.question_text, q.category, q.difficulty
        HAVING COUNT(ans.id) > 0
        ORDER BY (COUNT(ans.id) FILTER (WHERE ans.is_correct = false)::float / COUNT(ans.id)) DESC
        LIMIT 10
      `, values);

      return {
        hardestQuestions: res.rows.map(r => {
          const total = parseInt(r.total_answers, 10);
          const wrong = parseInt(r.wrong_answers, 10);
          return {
            id: r.id,
            questionText: r.question_text,
            category: r.category,
            difficulty: r.difficulty,
            totalAnswers: total,
            wrongAnswers: wrong,
            wrongPercentage: total > 0 ? parseFloat(((wrong / total) * 100).toFixed(1)) : 0
          };
        })
      };
    }
  },

  VIEW_STUDENT_HISTORY: {
    name: 'VIEW_STUDENT_HISTORY',
    description: 'Retrieve previous assessment attempts and scores of a student candidate.',
    requiresConfirmation: false,
    params: ['register_number', 'student_id'],
    execute: async (params) => {
      let studentId = params.student_id;
      let regNo = params.register_number;

      if (!studentId && regNo) {
        const sRes = await pool.query('SELECT id, full_name, register_number, department FROM students WHERE register_number ILIKE $1 OR user_id::text = $1', [regNo]);
        if (sRes.rows.length > 0) {
          studentId = sRes.rows[0].id;
          regNo = sRes.rows[0].register_number;
        }
      }

      if (!studentId) throw new Error(`Student with register number "${regNo || 'unknown'}" was not found.`);

      const studentRes = await pool.query('SELECT s.*, u.username FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = $1', [studentId]);
      if (studentRes.rows.length === 0) throw new Error('Student candidate not found');
      const student = studentRes.rows[0];

      const attemptsRes = await pool.query(`
        SELECT 
          att.id as attempt_id, att.started_at, att.submitted_at, att.status as attempt_status, att.score as attempt_score,
          a.id as assessment_id, a.title as assessment_title, a.duration_minutes, a.total_marks,
          r.score as result_score, r.percentage, r.correct_answers, r.wrong_answers, r.completed_at
        FROM attempts att
        JOIN assessments a ON att.assessment_id = a.id
        LEFT JOIN results r ON att.id = r.attempt_id
        WHERE att.student_id = $1
        ORDER BY att.started_at DESC
      `, [studentId]);

      return {
        candidate: {
          id: student.id,
          registerNumber: student.register_number,
          fullName: student.full_name,
          email: student.email,
          department: student.department,
          year: student.year
        },
        attemptsCount: attemptsRes.rows.length,
        attempts: attemptsRes.rows.map(r => ({
          attemptId: r.attempt_id,
          assessmentTitle: r.assessment_title,
          status: r.attempt_status,
          startedAt: r.started_at,
          submittedAt: r.submitted_at,
          score: r.result_score !== null ? parseFloat(r.result_score) : (r.attempt_score !== null ? parseFloat(r.attempt_score) : null),
          totalMarks: r.total_marks,
          percentage: r.percentage !== null ? parseFloat(r.percentage) : null,
          correctAnswers: r.correct_answers,
          wrongAnswers: r.wrong_answers
        }))
      };
    }
  },

  // ==========================================
  // 7. MONITORING & DASHBOARD TOOLS
  // ==========================================

  VIEW_LIVE_MONITORING: {
    name: 'VIEW_LIVE_MONITORING',
    description: 'Get live active exam monitoring feed and currently writing students.',
    requiresConfirmation: false,
    params: [],
    execute: async () => {
      return await dashboardService.getLiveMonitoringFeed();
    }
  },

  VIEW_ACTIVE_STUDENTS: {
    name: 'VIEW_ACTIVE_STUDENTS',
    description: 'Show candidates currently taking an exam in real-time.',
    requiresConfirmation: false,
    params: [],
    execute: async () => {
      const feed = await dashboardService.getLiveMonitoringFeed();
      return {
        activeCount: feed.activeSessions.length,
        activeSessions: feed.activeSessions
      };
    }
  },

  VIEW_DASHBOARD: {
    name: 'VIEW_DASHBOARD',
    description: 'Retrieve overall SkillsetrA admin dashboard statistics and metrics.',
    requiresConfirmation: false,
    params: [],
    execute: async () => {
      return await dashboardService.getDashboardOverview();
    }
  },

  VIEW_ACTIVITY: {
    name: 'VIEW_ACTIVITY',
    description: 'Get recent system activity logs and audit trail.',
    requiresConfirmation: false,
    params: ['limit'],
    execute: async (params) => {
      return await dashboardService.getRecentActivity(null, params.limit || 20);
    }
  },

  ADMIN_HELP: {
    name: 'ADMIN_HELP',
    description: 'Provide interactive Admin Help, guided navigation, and Copilot command documentation.',
    requiresConfirmation: false,
    params: ['topic'],
    execute: async () => {
      return {
        copilot: 'Skill AI',
        role: 'SkillsetrA Admin Operating Agent',
        status: 'Active & Connected',
        domains: [
          {
            title: 'Question Bank Operations',
            examples: [
              'Create 20 medium aptitude questions on percentage.',
              'Percentage la 20 medium questions create pannu.',
              'Search online for medium verbal placement questions.',
              'Import aptitude questions from this webpage URL.',
              'Find duplicate questions in the Question Bank.'
            ]
          },
          {
            title: 'Assessment & Test Management',
            examples: [
              'Create a 40 minute aptitude assessment with 30 questions.',
              'Create an assessment with 20 aptitude and 10 verbal questions.',
              'Publish Placement Test 1.',
              'Show all active assessments.'
            ]
          },
          {
            title: 'Student & Batch Assignments',
            examples: [
              'Assign Aptitude Test 1 to roll number 23ADS001.',
              'Assign this assessment to roll numbers 23ADS001, 23ADS002 and 23ADS003.',
              'Assign this test to all CSE third year students.',
              'Show students assigned to this assessment.'
            ]
          },
          {
            title: 'Candidate Search & Results',
            examples: [
              'Find roll number 23ADS001.',
              'Show result of roll number 23ADS001.',
              'Analyze Placement Test 1.',
              'Show weak questions with highest wrong answer rate.'
            ]
          }
        ],
        tips: [
          'Type commands in natural English, Tamil, or Tanglish.',
          'Click the 🎤 microphone for instant voice commands with audio synthesis.',
          'Attach .xlsx, .csv, .txt (with > marker), or .html files for instant parsing.',
          'All mutation operations provide a safety confirmation preview card before execution.'
        ]
      };
    }
  }
};

module.exports = {
  TOOL_REGISTRY
};
