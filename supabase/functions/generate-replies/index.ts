import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  screenshotBase64: string;
  userProfile: {
    personality_traits: Record<string, any>;
    language_habits: Record<string, any>;
    background_story: string | null;
  };
  previousSelections?: Array<{
    generated_replies: string[];
    selected_reply: string;
  }>;
}

Deno.serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { screenshotBase64, userProfile, previousSelections = [] } = await req.json() as RequestBody;

    // 构建用户画像描述
    let profileDescription = '用户画像：\n';
    
    if (userProfile.personality_traits && Object.keys(userProfile.personality_traits).length > 0) {
      profileDescription += `性格特征：${JSON.stringify(userProfile.personality_traits, null, 2)}\n`;
    }
    
    if (userProfile.language_habits && Object.keys(userProfile.language_habits).length > 0) {
      profileDescription += `语言习惯：${JSON.stringify(userProfile.language_habits, null, 2)}\n`;
    }
    
    if (userProfile.background_story) {
      profileDescription += `背景故事：${userProfile.background_story}\n`;
    }

    // 构建历史选择描述
    let historyDescription = '';
    if (previousSelections.length > 0) {
      historyDescription = '\n\n用户历史选择（用于学习用户偏好）：\n';
      previousSelections.slice(-5).forEach((selection, index) => {
        historyDescription += `\n选择 ${index + 1}:\n`;
        historyDescription += `生成的回复：${JSON.stringify(selection.generated_replies)}\n`;
        historyDescription += `用户选择：${selection.selected_reply}\n`;
      });
    }

    // 构建提示词
    const prompt = `你是一个智能回复助手。请分析这张聊天截图，并根据用户的个性特征生成4个符合其风格的回复建议。

${profileDescription}
${historyDescription}

【重要说明】
- 截图中显示的是别人发给用户的消息
- 你需要生成的是用户对这些消息的回复
- 用户是回复者，不是提问者
- 请站在用户的角度，用用户的语言风格来回复

要求：
1. 仔细识别截图中的聊天内容和上下文
2. 明确区分：截图中的消息是别人发的，你要生成的是用户的回复
3. 根据用户的性格特征、语言习惯和背景故事，生成符合其个性的回复
4. 特别注意用户的语言习惯：
   - 标点符号使用习惯（如：喜欢省略号、很少用标点等）
   - 断句方式（如：一句话说完、分多条发送等）
   - 常用词汇和口头禅
   - emoji使用频率和风格
   - 句子长度偏好
5. 如果有历史选择记录，学习用户的偏好模式
6. 生成4个不同风格的回复选项：
   - 前3个是具体的回复内容
   - 第4个是"以上都不太合适"，用于收集用户反馈

请以JSON格式返回，格式如下：
{
  "extracted_text": "从截图中提取的聊天文本（别人发给用户的消息）",
  "context_analysis": "对聊天上下文的分析，明确用户需要回复的内容",
  "replies": [
    {
      "text": "回复内容1（严格按照用户的标点、断句、emoji习惯）",
      "tone": "回复风格（如：轻松幽默、正式礼貌等）",
      "reasoning": "为什么这个回复适合用户（结合用户画像分析）"
    },
    {
      "text": "回复内容2",
      "tone": "回复风格",
      "reasoning": "选择理由"
    },
    {
      "text": "回复内容3",
      "tone": "回复风格",
      "reasoning": "选择理由"
    },
    {
      "text": "以上都不太合适，我想自己写",
      "tone": "反馈选项",
      "reasoning": "如果前面的回复都不满意，用户可以选择此项提供反馈，帮助系统学习"
    }
  ]
}`;

    // 调用Gemini API
    const geminiResponse = await fetch(
      'https://api-integrations.appmedo.com/app-8khk2ar42dc1/api-pLVzJnE6NKDL/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: screenshotBase64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API 错误: ${geminiResponse.status}`);
    }

    // 读取流式响应
    const reader = geminiResponse.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              if (jsonData.candidates?.[0]?.content?.parts?.[0]?.text) {
                fullText += jsonData.candidates[0].content.parts[0].text;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }

    // 提取JSON部分
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从AI响应中提取JSON数据');
    }

    const result = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Edge Function 错误:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : '未知错误' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
