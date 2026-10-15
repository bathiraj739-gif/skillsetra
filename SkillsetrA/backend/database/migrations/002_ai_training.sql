-- ====================================================================
-- AI Training Data Table
-- Stores custom knowledge entries that admins use to train/customize
-- the SkillsetrA AI Assistant's behavior and domain expertise.
-- ====================================================================

CREATE TABLE IF NOT EXISTS ai_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'GENERAL'
        CHECK (category IN ('GENERAL', 'QUESTION_BANK', 'ASSESSMENT', 'CANDIDATE', 'PLACEMENT', 'CUSTOM')),
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_ai_training_data_updated_at
    BEFORE UPDATE ON ai_training_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_ai_training_data_category ON ai_training_data (category);
CREATE INDEX idx_ai_training_data_is_active ON ai_training_data (is_active);
CREATE INDEX idx_ai_training_data_priority ON ai_training_data (priority DESC);
