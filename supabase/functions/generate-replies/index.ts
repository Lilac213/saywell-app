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

【重要说明 - 聊天截图识别规则】
1. **头像位置识别（最重要）**：
   - 左侧头像的消息 = 对方发的（这是需要回复的内容）
   - 右侧头像的消息 = 用户自己发的（用于学习用户的语言风格）
   - 注意：无论气泡颜色如何（白色、绿色、蓝色），都以头像位置为准！

2. **聊天顶部备注识别**：
   - 仔细查看截图最顶部的备注名称
   - 如果备注名称与用户设定的"特别关心的人"匹配，使用对应的关系信息
   - 如果没有匹配，根据聊天内容和语气推测关系

3. **情感识别（重要）**：
   - 仔细分析对方的情绪状态：热情、冷淡、敷衍、生气、开心、焦虑等
   - 识别对方的真实态度（冷淡、敷衍、热情、生气）

要求：
1. 仔细识别截图顶部的备注名称，判断对方与用户的关系
2. 从右侧头像的消息学习用户的真实语言风格（人称、语气词、标点、断句等）
3. 准确识别对方的情感状态
4. 综合分析左侧头像的所有消息内容
5. 根据对方的情感状态和关系，生成不同风格的回复
6. 结合用户的性格特点生成回复
7. 生成4个不同风格的回复选项

请以JSON格式返回，格式如下：
{
  "extracted_text": "从截图中提取的聊天文本",
  "chat_remark": "截图顶部显示的备注名称",
  "relationship": "推测的关系",
  "context_analysis": "对聊天上下文的分析",
  "emotion_analysis": "对方的情感状态分析",
  "intent_analysis": "分析对方想表达什么",
  "user_style_observation": "从右侧头像消息中观察到的用户实际语言风格",
  "replies": [
    {
      "text": "回复内容1",
      "tone": "语气风格",
      "reasoning": "选择理由"
    },
    ... (共4个)
  ]
}`;

    // 处理图片数据
    let imageUrl = screenshotBase64;
    // 如果没有前缀，添加前缀 (默认为webp，因为前端已经改为webp压缩)
    if (!imageUrl.startsWith('data:')) {
      imageUrl = `data:image/webp;base64,${imageUrl}`;
    }

    // 调用通义千问 Qwen-VL API (DashScope)
    const dashscopeKey = Deno.env.get('DASHSCOPE_API_KEY');
    if (!dashscopeKey) {
      throw new Error('未配置 DASHSCOPE_API_KEY');
    }

    // 使用 OpenAI 兼容接口调用 Qwen-VL
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dashscopeKey}`
      },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen-VL API 错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Qwen-VL API 返回内容为空');
    }

    // 提取JSON部分
    const jsonMatch = content.match(/\{[\s\S]*\}/);
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
