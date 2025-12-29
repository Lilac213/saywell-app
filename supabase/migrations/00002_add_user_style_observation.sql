-- Add user_style_observation column to chat_sessions table
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS user_style_observation TEXT;