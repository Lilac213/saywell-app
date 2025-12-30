-- 创建清理旧数据的函数
CREATE OR REPLACE FUNCTION cleanup_old_session_data(user_profile_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 删除超过7天的聊天会话截图（保留最近的5条）
  DELETE FROM chat_sessions
  WHERE user_profile_id = user_profile_id_param
  AND id NOT IN (
    SELECT id FROM chat_sessions
    WHERE user_profile_id = user_profile_id_param
    ORDER BY created_at DESC
    LIMIT 5
  )
  AND created_at < NOW() - INTERVAL '7 days';
  
  -- 删除超过30天的问卷回答记录
  DELETE FROM questionnaire_responses
  WHERE user_profile_id = user_profile_id_param
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 创建定时清理触发器（当用户画像更新时自动清理）
CREATE OR REPLACE FUNCTION trigger_cleanup_on_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 如果问卷已完成，执行清理
  IF NEW.questionnaire_completed = true THEN
    PERFORM cleanup_old_session_data(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS cleanup_trigger ON user_profiles;
CREATE TRIGGER cleanup_trigger
AFTER UPDATE ON user_profiles
FOR EACH ROW
WHEN (NEW.questionnaire_completed = true)
EXECUTE FUNCTION trigger_cleanup_on_profile_update();

COMMENT ON FUNCTION cleanup_old_session_data IS '清理用户的旧聊天会话和问卷记录，保留最近5条会话和30天内的问卷记录';
COMMENT ON FUNCTION trigger_cleanup_on_profile_update IS '当用户画像更新时自动触发数据清理';