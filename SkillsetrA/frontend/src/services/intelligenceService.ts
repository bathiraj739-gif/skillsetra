import api from './api';

export interface PlacementOverviewData {
  total_students: number;
  published_assessments: number;
  total_attempts: number;
  completed_attempts: number;
  in_progress_attempts: number;
  completion_rate: number;
  pass_rate: number;
  avg_percentage: number;
  avg_score: number;
  max_percentage: number;
  min_percentage: number;
  overall_accuracy: number;
  sections: {
    aptitude: { total_answers: number; correct: number; wrong: number; accuracy: number; total_marks?: number };
    verbal: { total_answers: number; correct: number; wrong: number; accuracy: number; total_marks?: number };
  };
  difficulty_breakdown: {
    easy: number;
    medium: number;
    hard: number;
  };
}

export interface DepartmentIntelligenceData {
  department: string;
  student_count: number;
  total_attempts: number;
  completed_evaluations: number;
  avg_percentage: number;
  avg_score: number;
  max_percentage: number;
  pass_rate: number;
  aptitude_accuracy: number;
  verbal_accuracy: number;
  completion_rate: number;
}

export interface YearIntelligenceData {
  year: string;
  student_count: number;
  total_attempts: number;
  completed_evaluations: number;
  avg_percentage: number;
  avg_score: number;
  pass_rate: number;
  aptitude_accuracy: number;
  verbal_accuracy: number;
  completion_rate: number;
}

export interface PerformanceTrendItem {
  assessment_id: string;
  title: string;
  date: string;
  participants: number;
  avg_percentage: number;
  avg_score: number;
  pass_rate: number;
}

export interface StudentSkillProfile {
  student_id: string;
  full_name: string;
  register_number: string;
  department: string;
  year: string;
  assessments_completed: number;
  overall_percentage: number;
  aptitude_accuracy: number;
  verbal_accuracy: number;
  strong_section: string;
  needs_improvement: string;
}

export interface QuestionQualityItem {
  id: string;
  question_text: string;
  category: 'APTITUDE' | 'VERBAL';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  correct_option: string;
  marks: number;
  is_active: boolean;
  created_at: string;
  total_attempts: number;
  answered_count: number;
  unanswered_count: number;
  correct_count: number;
  wrong_count: number;
  accuracy_percentage: number;
  quality_indicator: 'VERY_EASY' | 'EASY' | 'NORMAL' | 'DIFFICULT' | 'VERY_DIFFICULT' | 'INSUFFICIENT_DATA';
  flags: {
    high_failure_rate: boolean;
    high_skip_rate: boolean;
    ambiguous: boolean;
    insufficient_data: boolean;
  };
  option_distribution: {
    A: { count: number; percentage: number };
    B: { count: number; percentage: number };
    C: { count: number; percentage: number };
    D: { count: number; percentage: number };
  };
}

export interface QuestionQualityResponse {
  summary: {
    total_questions: number;
    very_easy_count: number;
    easy_count: number;
    normal_count: number;
    difficult_count: number;
    very_difficult_count: number;
    insufficient_data_count: number;
    flagged_count: number;
  };
  questions: QuestionQualityItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const intelligenceService = {
  async getOverview(): Promise<PlacementOverviewData> {
    const res: any = await api.get('/admin/intelligence/overview');
    return res?.data?.data || res?.data || res;
  },

  async getDepartments(): Promise<DepartmentIntelligenceData[]> {
    const res: any = await api.get('/admin/intelligence/departments');
    return res?.data?.data || res?.data || [];
  },

  async getYears(): Promise<YearIntelligenceData[]> {
    const res: any = await api.get('/admin/intelligence/years');
    return res?.data?.data || res?.data || [];
  },

  async getTrends(): Promise<PerformanceTrendItem[]> {
    const res: any = await api.get('/admin/intelligence/trends');
    return res?.data?.data || res?.data || [];
  },

  async getStudentSkills(limit: number = 25): Promise<StudentSkillProfile[]> {
    const res: any = await api.get('/admin/intelligence/student-skills', { params: { limit } });
    return res?.data?.data || res?.data || [];
  },

  async getTopics(): Promise<{ available: boolean; message?: string; topics?: any[] }> {
    const res: any = await api.get('/admin/intelligence/topics');
    return res?.data?.data || res?.data || { available: false, message: 'Topic metadata not available' };
  },

  async getQuestionQualityList(params: {
    category?: string;
    difficulty?: string;
    quality?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: string;
  }): Promise<QuestionQualityResponse> {
    const res: any = await api.get('/admin/intelligence/questions', { params });
    return res?.data || res;
  },

  async getQuestionDetailedAnalytics(id: string): Promise<any> {
    const res: any = await api.get(`/admin/intelligence/questions/${id}`);
    return res?.data?.data || res?.data || res;
  }
};
