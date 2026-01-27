-- Safe migration to ensure L2 table and types exist

-- 1. Create Enums if they don't exist
DO $$ BEGIN
    CREATE TYPE scenario_type AS ENUM ('恋爱', '职场', '朋友', '家庭', '其他');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE relationship_type_enum AS ENUM ('暧昧', '上下级', '同事', '朋友', '亲人', '陌生人', '其他');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE intent_category_enum AS ENUM ('share', 'seek_support', 'seek_advice', 'test_boundary', 'express_dissatisfaction', 'conflict', 'coordination', 'casual_chat', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE emotion_primary_enum AS ENUM ('positive', 'neutral', 'negative');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE emotion_type_enum AS ENUM ('joy', 'excitement', 'relief', 'sadness', 'anxiety', 'anger', 'disappointment', 'embarrassment', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reply_style_enum AS ENUM ('共情', '理性', '轻松', '克制', '幽默', '直接', '其他');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE response_delay_bucket_enum AS ENUM ('即时', '1-5min', '5min+', 'unknown');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Table if not exists
CREATE TABLE IF NOT EXISTS conversation_analysis_features (
    feature_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add columns if they don't exist
DO $$ BEGIN
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS scenario scenario_type;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS relationship_type relationship_type_enum;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS created_date DATE DEFAULT CURRENT_DATE;
    
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS intent_category intent_category_enum;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS intent_strength FLOAT CHECK (intent_strength >= 0 AND intent_strength <= 1);
    
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS emotion_primary emotion_primary_enum;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS emotion_type emotion_type_enum;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS emotion_intensity FLOAT CHECK (emotion_intensity >= 0 AND emotion_intensity <= 1);
    
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS sarcasm BOOLEAN;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS humor BOOLEAN;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS indirectness FLOAT CHECK (indirectness >= 0 AND indirectness <= 1);
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS emotional_volatility FLOAT;
    
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS recommended_reply_style reply_style_enum;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS reply_count INTEGER;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS selected_style reply_style_enum;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS response_delay_bucket response_delay_bucket_enum;
    
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS message_count INTEGER;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS avg_message_length INTEGER;
    ALTER TABLE conversation_analysis_features ADD COLUMN IF NOT EXISTS turn_count INTEGER;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_created_date ON conversation_analysis_features(created_date);
CREATE INDEX IF NOT EXISTS idx_analysis_scenario ON conversation_analysis_features(scenario);
CREATE INDEX IF NOT EXISTS idx_analysis_intent ON conversation_analysis_features(intent_category);
CREATE INDEX IF NOT EXISTS idx_analysis_emotion ON conversation_analysis_features(emotion_primary);

-- 5. Enable RLS
ALTER TABLE conversation_analysis_features ENABLE ROW LEVEL SECURITY;

-- 6. Add Policies (Idempotent)
DO $$ BEGIN
    CREATE POLICY "Allow public insert on conversation_analysis_features"
    ON conversation_analysis_features FOR INSERT
    TO public
    WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Allow public read on conversation_analysis_features"
    ON conversation_analysis_features FOR SELECT
    TO public
    USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
