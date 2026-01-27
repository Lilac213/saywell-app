import { supabase } from './supabase';
import type { 
  UserProfile, 
  ChatSession, 
  ReplySelection, 
  QuestionnaireResponse 
} from '@/types/types';

// 用户画像相关API
export const userProfileApi = {
  // 创建新用户画像
  async create(): Promise<UserProfile | null> {
    const { data, error } = await supabase.functions.invoke('user-profile', {
      body: { action: 'create' }
    });
    
    if (error) {
      console.error('创建用户画像失败:', error);
      return null;
    }
    return data;
  },

  // 获取用户画像
  async getById(id: string): Promise<UserProfile | null> {
    const { data, error } = await supabase.functions.invoke('user-profile', {
      body: { action: 'get', id }
    });
    
    if (error) {
      console.error('获取用户画像失败:', error);
      return null;
    }
    return data;
  },

  // 更新用户画像
  async update(id: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data, error } = await supabase.functions.invoke('user-profile', {
      body: { action: 'update', id, ...updates }
    });
    
    if (error) {
      console.error('更新用户画像失败:', error);
      return null;
    }
    return data;
  },

  // 标记问卷已完成
  async markQuestionnaireCompleted(id: string): Promise<boolean> {
    const { error } = await supabase.functions.invoke('user-profile', {
      body: { action: 'update', id, questionnaire_completed: true }
    });
    
    if (error) {
      console.error('标记问卷完成失败:', error);
      return false;
    }
    return true;
  }
};

// 聊天会话相关API
export const chatSessionApi = {
  // 创建新聊天会话
  async create(userProfileId: string, screenshotUrl: string, extractedText?: string): Promise<ChatSession | null> {
    const { data, error } = await supabase.functions.invoke('chat-session', {
      body: { 
        action: 'create',
        user_profile_id: userProfileId, 
        screenshot_url: screenshotUrl,
        extracted_text: extractedText
      }
    });
    
    if (error) {
      console.error('创建聊天会话失败:', error);
      return null;
    }
    return data;
  },

  // 更新聊天会话
  async update(id: string, updates: Partial<ChatSession>): Promise<ChatSession | null> {
    const { data, error } = await supabase.functions.invoke('chat-session', {
      body: { action: 'update', id, ...updates }
    });
    
    if (error) {
      console.error('更新聊天会话失败:', error);
      return null;
    }
    return data;
  },

  // 获取用户的所有聊天会话
  async getByUserProfile(userProfileId: string, limit = 20): Promise<ChatSession[]> {
    const { data, error } = await supabase.functions.invoke('chat-session', {
      body: { action: 'list', user_profile_id: userProfileId, limit }
    });
    
    if (error) {
      console.error('获取聊天会话失败:', error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  },

  // 获取单个聊天会话
  async getById(id: string): Promise<ChatSession | null> {
    const { data, error } = await supabase.functions.invoke('chat-session', {
      body: { action: 'get', id }
    });
    
    if (error) {
      console.error('获取聊天会话失败:', error);
      return null;
    }
    return data;
  },

  // 创建分析特征
  async createAnalysisFeatures(sessionId: string, userProfileId: string, features: any): Promise<any | null> {
    const { data, error } = await supabase.functions.invoke('chat-session', {
      body: { 
        action: 'createAnalysisFeatures',
        session_id: sessionId,
        user_profile_id: userProfileId,
        features
      }
    });
    
    if (error) {
      console.error('创建分析特征失败:', error);
      return null;
    }
    return data;
  }
};

// 回复选择记录相关API
export const replySelectionApi = {
  // 创建回复选择记录
  async create(
    chatSessionId: string, 
    generatedReplies: string[] | any[], 
    selectedReply: string, 
    selectionIndex: number
  ): Promise<ReplySelection | null> {
    const { data, error } = await supabase.functions.invoke('reply-selection', {
      body: { 
        action: 'create',
        chat_session_id: chatSessionId, 
        generated_replies: generatedReplies, 
        selected_reply: selectedReply, 
        selection_index: selectionIndex 
      }
    });
    
    if (error) {
      console.error('创建回复选择记录失败:', error);
      return null;
    }
    return data;
  },

  // 获取聊天会话的回复选择记录
  async getByChatSession(chatSessionId: string): Promise<ReplySelection | null> {
    const { data, error } = await supabase.functions.invoke('reply-selection', {
      body: { action: 'get', chat_session_id: chatSessionId }
    });
    
    if (error) {
      console.error('获取回复选择记录失败:', error);
      return null;
    }
    return data;
  }
};

// 问卷回答相关API
export const questionnaireApi = {
  // 批量创建问卷回答
  async createBatch(
    userProfileId: string, 
    responses: Array<{ question: string; answer: string; question_order: number }>
  ): Promise<boolean> {
    const { error } = await supabase.functions.invoke('questionnaire', {
      body: { 
        action: 'createBatch',
        user_profile_id: userProfileId, 
        responses 
      }
    });
    
    if (error) {
      console.error('批量创建问卷回答失败:', error);
      return false;
    }
    return true;
  },

  // 获取用户的所有问卷回答
  async getByUserProfile(userProfileId: string): Promise<QuestionnaireResponse[]> {
    const { data, error } = await supabase.functions.invoke('questionnaire', {
      body: { action: 'get', user_profile_id: userProfileId }
    });
    
    if (error) {
      console.error('获取问卷回答失败:', error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  }
};
