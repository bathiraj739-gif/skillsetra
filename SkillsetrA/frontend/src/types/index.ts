export type UserRole = 'student' | 'admin'

export interface Profile {
  id: string
  name: string
  full_name?: string
  username?: string
  email: string
  register_number?: string
  department?: string
  year?: number
  year_of_study?: string
  role: UserRole
  created_at?: string
  updated_at?: string
}

export type QuestionSection = 'aptitude' | 'verbal'
export type QuestionDifficulty = 'easy' | 'medium' | 'hard'
export type QuestionOption = 'A' | 'B' | 'C' | 'D'

export interface Question {
  id: string
  question_text: string
  section: QuestionSection
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: QuestionOption
  marks: number
  difficulty: QuestionDifficulty
  topic?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type AssessmentStatus = 'draft' | 'published' | 'active' | 'completed' | 'archived'

export interface Assessment {
  id: string
  title: string
  description?: string
  aptitude_count: number
  verbal_count: number
  duration_minutes: number
  start_time?: string
  end_time?: string
  passing_percentage: number
  status: AssessmentStatus
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface AssessmentAssignment {
  id: string
  assessment_id: string
  student_id: string
  assigned_at: string
  due_date?: string
  status: string
  assessment?: Assessment
  student?: Profile
}

export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED'

export interface Attempt {
  id: string
  assessment_id: string
  student_id: string
  started_at: string
  submitted_at?: string
  status: AttemptStatus
  score?: number
  percentage?: number
  assessment?: Assessment
}

export interface ExamQuestion {
  id: string
  question_order?: number
  order?: number
  question_text: string
  section: QuestionSection
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer?: QuestionOption
  marks: number
  difficulty?: string
}

export interface SavedAnswer {
  question_id?: string
  questionId?: string
  selected_answer?: QuestionOption | null
  selectedOption?: QuestionOption | null
  is_marked_for_review?: boolean
  savedAt?: string
}

export interface StartAttemptResponse {
  attempt_id?: string
  attemptId?: string
  id?: string
  assessmentId?: string
  assessmentTitle?: string
  status?: AttemptStatus | any
  assessment?: {
    id: string
    title: string
    description?: string
    duration_minutes: number
  }
  started_at?: string
  startedAt?: string
  expires_at?: string
  expiresAt?: string
  remaining_seconds?: number
  remainingSeconds?: number
  questions?: ExamQuestion[]
  saved_answers?: SavedAnswer[]
}


export interface AnswerPayload {
  attempt_id?: string
  attemptId?: string
  question_id?: string
  questionId?: string
  selected_answer?: QuestionOption | null
  selectedOption?: QuestionOption | null
  is_marked_for_review?: boolean
}

export interface AnswerReportItem {
  question_number: number
  question_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  selected_option: QuestionOption | null
  correct_option: QuestionOption
  status: 'Correct' | 'Wrong' | 'Unanswered'
  marks_awarded: number
  question_marks: number
}

export interface Result {
  id: string
  attempt_id: string
  student_id: string
  assessment_id: string
  aptitude_score?: number
  verbal_score?: number
  total_score?: number
  total_marks?: number
  total_questions: number
  correct_answers: number
  incorrect_answers?: number
  wrong_answers?: number
  unanswered: number
  score: number
  percentage: number
  passed?: boolean
  time_taken_seconds?: number
  created_at?: string
  submitted_at?: string
  completed_at?: string
  student?: Profile
  assessment?: Assessment
  student_name?: string
  register_number?: string
  department?: string
  assessment_title?: string
  answer_report?: AnswerReportItem[]
}

