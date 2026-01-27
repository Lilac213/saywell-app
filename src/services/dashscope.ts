import { supabase } from '../db/supabase';

const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

export async function callDashScope(
  messages: any[],
  model: string = 'qwen-plus',
  options: {
    temperature?: number;
    top_p?: number;
    response_format?: { type: 'text' | 'json_object' };
  } = {}
) {
  const apiKey = import.meta.env.VITE_DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 VITE_DASHSCOPE_API_KEY，请在 .env 文件中设置');
  }

  const response = await fetch(DASHSCOPE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      ...options
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DashScope API 错误: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('DashScope API 返回内容为空');
  }

  return content;
}
