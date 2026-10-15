-- Migration 001: Next-Level Intelligence Features (Adaptive Assessments, Question Quality, Placement Intelligence)

-- 1. Assessment Adaptive Configuration Columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assessments' AND column_name = 'assessment_mode'
    ) THEN
        ALTER TABLE assessments ADD COLUMN assessment_mode VARCHAR(20) NOT NULL DEFAULT 'STANDARD' CHECK (assessment_mode IN ('STANDARD', 'ADAPTIVE'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assessments' AND column_name = 'starting_difficulty'
    ) THEN
        ALTER TABLE assessments ADD COLUMN starting_difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (starting_difficulty IN ('EASY', 'MEDIUM', 'HARD'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assessments' AND column_name = 'min_questions'
    ) THEN
        ALTER TABLE assessments ADD COLUMN min_questions INTEGER NOT NULL DEFAULT 20 CHECK (min_questions > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assessments' AND column_name = 'max_questions'
    ) THEN
        ALTER TABLE assessments ADD COLUMN max_questions INTEGER NOT NULL DEFAULT 30 CHECK (max_questions >= min_questions);
    END IF;
END $$;

-- 2. Performance Indexes for Question Quality & Intelligence Aggregations
CREATE INDEX IF NOT EXISTS idx_questions_cat_diff_active ON questions (category, difficulty, is_active);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers (question_id);
CREATE INDEX IF NOT EXISTS idx_answers_is_correct ON answers (is_correct);
CREATE INDEX IF NOT EXISTS idx_attempt_questions_question_id ON attempt_questions (question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts (status);
CREATE INDEX IF NOT EXISTS idx_results_completed_at ON results (completed_at);
