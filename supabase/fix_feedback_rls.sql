-- 修复 ai_feedbacks 表的权限问题

-- 1. 确保表启用了 RLS (Row Level Security)
ALTER TABLE ai_feedbacks ENABLE ROW LEVEL SECURITY;

-- 2. 删除旧的策略（如果存在），防止冲突
DROP POLICY IF EXISTS "Allow authenticated users to insert feedback" ON ai_feedbacks;
DROP POLICY IF EXISTS "Allow users to view their own feedback" ON ai_feedbacks;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON ai_feedbacks;

-- 3. 创建插入策略：允许所有登录用户提交反馈
-- 这里的 auth.uid() 是 Supabase 提供的当前登录用户 ID
-- 如果您只想允许测试人员提交，可以将 WITH CHECK 改为：
-- WITH CHECK (exists (select 1 from user_profiles where id = auth.uid() and is_tester = true));
CREATE POLICY "Allow authenticated users to insert feedback" 
ON ai_feedbacks 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 4. 创建查看策略：允许用户查看自己提交的反馈
CREATE POLICY "Allow users to view their own feedback" 
ON ai_feedbacks 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 5. 如果有 update 需求，也可以添加
-- CREATE POLICY "Allow users to update their own feedback" ...
