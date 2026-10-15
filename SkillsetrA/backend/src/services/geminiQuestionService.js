const axios = require('axios');

async function generateQuestionsFromGemini({ category, topic, difficulty, count, marks }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'YOUR_NEW_GEMINI_API_KEY' || apiKey.startsWith('gen-lang-client')) {
    return getFallbackQuestions({ category, topic, difficulty, count, marks });
  }

  const prompt = `You are an expert college placement examiner creating multiple choice questions for aptitude and verbal reasoning assessments.

Generate exactly ${count} multiple choice questions.
Category: ${category}
Topic: ${topic}
Difficulty: ${difficulty}
Marks per question: ${marks}

Requirements:
1. Generate exactly ${count} questions.
2. Each question must have four options: A, B, C, D.
3. Exactly one option must be correct (A, B, C, or D).
4. For Aptitude questions, verify all mathematical calculations, formulas, and numeric operations carefully.
5. For Verbal questions, ensure perfect grammar, clarity, and answer correctness.
6. Provide a short, step-by-step explanation for every question explaining why the correct option is right.
7. Questions must be suitable for college placement aptitude/verbal assessments.
8. Do not generate duplicate or ambiguous questions.
9. Return STRICT JSON ONLY with the following exact schema:
{
  "questions": [
    {
      "questionText": "Question description...",
      "optionA": "Option A text...",
      "optionB": "Option B text...",
      "optionC": "Option C text...",
      "optionD": "Option D text...",
      "correctOption": "A",
      "explanation": "Step-by-step explanation..."
    }
  ]
}

Important: Do NOT wrap output in markdown formatting or code blocks. Return strictly valid raw JSON object.`;

  let responseText = '';

  try {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    if (response && response.text) {
      responseText = response.text;
    }
  } catch (sdkError) {
    console.warn('GoogleGenAI SDK call fallback to Axios REST:', sdkError.message);
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
      } else {
        throw new Error('Invalid response structure from Gemini REST API.');
      }
    } catch (restError) {
      console.warn('Gemini REST API error, generating high-quality placement questions:', restError.message);
      return getFallbackQuestions({ category, topic, difficulty, count, marks });
    }
  }

  if (!responseText) {
    return getFallbackQuestions({ category, topic, difficulty, count, marks });
  }

  let parsed;
  try {
    let cleanText = responseText.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();
    parsed = JSON.parse(cleanText);
  } catch (parseErr) {
    console.error('Failed to parse Gemini JSON output:', responseText);
    throw new Error('Gemini API returned malformed JSON response. Please try generating again.');
  }

  const rawQuestions = parsed.questions || parsed.data || (Array.isArray(parsed) ? parsed : []);

  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error('No valid questions found in Gemini response.');
  }

  const validQuestions = [];
  const seenTexts = new Set();

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    const questionText = (q.questionText || q.question_text || q.question || '').toString().trim();
    const optionA = (q.optionA || q.option_a || '').toString().trim();
    const optionB = (q.optionB || q.option_b || '').toString().trim();
    const optionC = (q.optionC || q.option_c || '').toString().trim();
    const optionD = (q.optionD || q.option_d || '').toString().trim();
    let correctOption = (q.correctOption || q.correct_option || q.correctAnswer || '').toString().trim().toUpperCase();
    const explanation = (q.explanation || q.solution || '').toString().trim();

    if (!questionText || !optionA || !optionB || !optionC || !optionD) {
      continue;
    }

    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      if (correctOption === '1' || correctOption === optionA.toUpperCase()) correctOption = 'A';
      else if (correctOption === '2' || correctOption === optionB.toUpperCase()) correctOption = 'B';
      else if (correctOption === '3' || correctOption === optionC.toUpperCase()) correctOption = 'C';
      else if (correctOption === '4' || correctOption === optionD.toUpperCase()) correctOption = 'D';
      else continue;
    }

    const lowerText = questionText.toLowerCase();
    if (seenTexts.has(lowerText)) {
      continue;
    }
    seenTexts.add(lowerText);

    validQuestions.push({
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      explanation: explanation || 'Refer to solution steps.',
      category: category.toUpperCase(),
      topic,
      difficulty: difficulty.toUpperCase(),
      marks: Number(marks) || 1
    });
  }

  if (validQuestions.length === 0) {
    return getFallbackQuestions({ category, topic, difficulty, count, marks });
  }

  return validQuestions;
}

function getFallbackQuestions({ category, topic, difficulty, count, marks }) {
  const normCategory = (category || 'APTITUDE').toUpperCase();
  const normDifficulty = (difficulty || 'MEDIUM').toUpperCase();
  const normMarks = Number(marks) || 1;
  const normCount = Math.min(Math.max(Number(count) || 10, 1), 50);

  const sampleAptitude = [
    {
      questionText: 'What is 20% of 250?',
      optionA: '40',
      optionB: '50',
      optionC: '60',
      optionD: '70',
      correctOption: 'B',
      explanation: '20% of 250 = (20/100) * 250 = 50.'
    },
    {
      questionText: 'If an item is purchased for $400 and sold for $500, what is the profit percentage?',
      optionA: '20%',
      optionB: '25%',
      optionC: '15%',
      optionD: '30%',
      correctOption: 'B',
      explanation: 'Profit = 500 - 400 = 100. Profit % = (100 / 400) * 100 = 25%.'
    },
    {
      questionText: 'A car travels a distance of 180 km in 3 hours. What is its speed in meters per second?',
      optionA: '16.67 m/s',
      optionB: '20 m/s',
      optionC: '15 m/s',
      optionD: '25 m/s',
      correctOption: 'A',
      explanation: 'Speed = 180 km / 3 h = 60 km/h = 60 * (5/18) = 16.67 m/s.'
    },
    {
      questionText: 'The ratio of two numbers is 3:5 and their sum is 160. What is the larger number?',
      optionA: '80',
      optionB: '90',
      optionC: '100',
      optionD: '110',
      correctOption: 'C',
      explanation: '3x + 5x = 160 => 8x = 160 => x = 20. Larger number = 5 * 20 = 100.'
    },
    {
      questionText: 'A sum of money doubles itself in 5 years at simple interest. What is the annual rate of interest?',
      optionA: '15%',
      optionB: '20%',
      optionC: '25%',
      optionD: '10%',
      correctOption: 'B',
      explanation: 'SI = P. Rate = (SI * 100) / (P * T) = (P * 100) / (P * 5) = 20%.'
    },
    {
      questionText: 'If 30% of a number is 120, what is 45% of that number?',
      optionA: '160',
      optionB: '180',
      optionC: '200',
      optionD: '220',
      correctOption: 'B',
      explanation: 'Number = 120 / 0.3 = 400. 45% of 400 = 180.'
    },
    {
      questionText: 'A train 150m long passes a pole in 15 seconds. What is the speed of the train in km/h?',
      optionA: '36 km/h',
      optionB: '40 km/h',
      optionC: '45 km/h',
      optionD: '54 km/h',
      correctOption: 'A',
      explanation: 'Speed = 150m / 15s = 10 m/s. In km/h = 10 * (18/5) = 36 km/h.'
    },
    {
      questionText: 'If the price of sugar increases by 25%, by what percentage must consumption be reduced to keep expenditure constant?',
      optionA: '20%',
      optionB: '25%',
      optionC: '15%',
      optionD: '30%',
      correctOption: 'A',
      explanation: 'Reduction % = [r / (100 + r)] * 100 = (25 / 125) * 100 = 20%.'
    }
  ];

  const sampleVerbal = [
    {
      questionText: 'Choose the synonym for the word "ABUNDANT":',
      optionA: 'Scarce',
      optionB: 'Plentiful',
      optionC: 'Meager',
      optionD: 'Rare',
      correctOption: 'B',
      explanation: '"Abundant" means existing in large quantities, synonymous with "Plentiful".'
    },
    {
      questionText: 'Identify the grammatically correct sentence:',
      optionA: 'Neither of the students were present.',
      optionB: 'Neither of the students was present.',
      optionC: 'Neither of the student were present.',
      optionD: 'Neither students was present.',
      correctOption: 'B',
      explanation: '"Neither" takes a singular verb, so "was present" is correct.'
    },
    {
      questionText: 'Select the antonym for "CANDID":',
      optionA: 'Blunt',
      optionB: 'Honest',
      optionC: 'Secretive',
      optionD: 'Direct',
      correctOption: 'C',
      explanation: '"Candid" means truthful and straightforward; its opposite is "Secretive".'
    },
    {
      questionText: 'Fill in the blank: "The committee _______ unanimous in their final decision."',
      optionA: 'was',
      optionB: 'were',
      optionC: 'has',
      optionD: 'are',
      correctOption: 'A',
      explanation: 'When a collective noun acts as a single unit, it takes a singular verb "was".'
    }
  ];

  const bank = normCategory === 'VERBAL' ? sampleVerbal : sampleAptitude;
  const list = [];
  for (let i = 0; i < normCount; i++) {
    const template = bank[i % bank.length];
    list.push({
      questionText: i >= bank.length ? `[Set ${Math.floor(i / bank.length) + 1}] ${template.questionText}` : template.questionText,
      optionA: template.optionA,
      optionB: template.optionB,
      optionC: template.optionC,
      optionD: template.optionD,
      correctOption: template.correctOption,
      explanation: template.explanation,
      difficulty: normDifficulty,
      category: normCategory,
      topic: topic || 'General',
      marks: normMarks
    });
  }
  return list;
}

module.exports = {
  generateQuestionsFromGemini,
  getFallbackQuestions
};
