-- 创建用户画像表
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  personality_traits JSONB DEFAULT '{}',
  language_habits JSONB DEFAULT '{}',
  background_story TEXT,
  questionnaire_completed BOOLEAN DEFAULT FALSE
);

-- 创建聊天会话表
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  screenshot_url TEXT NOT NULL,
  extracted_text TEXT,
  context JSONB DEFAULT '{}'
);

-- 创建回复选择记录表
CREATE TABLE reply_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  generated_replies JSONB NOT NULL,
  selected_reply TEXT NOT NULL,
  selection_index INTEGER NOT NULL
);

-- 创建问卷回答表
CREATE TABLE questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  question_order INTEGER NOT NULL
);

-- 创建存储桶用于截图
INSERT INTO storage.buckets (id, name, public) 
VALUES ('app-8khk2ar42dc1_screenshots', 'app-8khk2ar42dc1_screenshots', true);

-- 设置存储桶策略：允许所有人上传和读取
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'app-8khk2ar42dc1_screenshots');

CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'app-8khk2ar42dc1_screenshots');

-- 设置表的RLS策略（无需登录，公开访问）
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on user_profiles"
ON user_profiles FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on chat_sessions"
ON chat_sessions FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on reply_selections"
ON reply_selections FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on questionnaire_responses"
ON questionnaire_responses FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 创建索引以提高查询性能
CREATE INDEX idx_chat_sessions_user_profile ON chat_sessions(user_profile_id);
CREATE INDEX idx_reply_selections_chat_session ON reply_selections(chat_session_id);
CREATE INDEX idx_questionnaire_responses_user_profile ON questionnaire_responses(user_profile_id);