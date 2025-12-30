// 用户画像类型
export interface UserProfile {
  id: string;
  created_at: string;
  updated_at: string;
  personality_traits: Record<string, any>;
  language_habits: Record<string, any>;
  background_story: string | null;
  questionnaire_completed: boolean;
}

// 聊天会话类型
export interface ChatSession {
  id: string;
  user_profile_id: string;
  created_at: string;
  screenshot_url: string;
  extracted_text: string | null;
  context: Record<string, any>;
  user_style_observation?: string | null;
}

// 回复选择记录类型
export interface ReplySelection {
  id: string;
  chat_session_id: string;
  created_at: string;
  generated_replies: string[];
  selected_reply: string;
  selection_index: number;
}

// 问卷回答类型
export interface QuestionnaireResponse {
  id: string;
  user_profile_id: string;
  created_at: string;
  question: string;
  answer: string;
  question_order: number;
}

// 问卷问题类型
export interface QuestionnaireQuestion {
  id: number;
  question: string;
  placeholder?: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect';
  options?: string[];
  conditionalOn?: number;
  conditionalValue?: string;
}

// AI生成的回复类型
export interface GeneratedReply {
  text: string;
  tone: string;
  reasoning: string;
}
