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
   - 仔细查看截图最顶部的备注名称（通常在标题栏）
   - 如果备注名称与用户设定的"特别关心的人"匹配，使用对应的关系信息
   - 如果没有匹配，根据聊天内容和语气推测关系（领导、同事、朋友、父母、爱人、暧昧对象、追求对象、追求者等）
   
3. **特殊情况处理**：
   - 合并转发的内容：通常显示为灰色背景，包含多条历史消息，不是当前对话
   - 转发的链接：固定白色显示，但要看头像位置判断是谁发的
   - 如果有多条左侧头像的消息，需要综合分析所有内容，可能包含多个问题

4. **语言习惯学习（从右侧消息中提取）**：
   - 人称代词：观察用户用"我"、"本人"、"俺"、"咱"等哪个
   - 语气词：观察用户用"噢"、"哦"、"嗯"、"啊"等的习惯
   - 标点符号：实际使用频率和偏好
   - 断句方式：一条长消息 vs 多条短消息
   - emoji使用：频率和位置
   - 常用词汇和口头禅

5. **情感识别（重要）**：
   - 仔细分析对方的情绪状态：热情、冷淡、敷衍、生气、开心、焦虑等
   - 识别对方的真实态度：
     * 冷淡信号：简短回复（"嗯"、"哦"、"好"）、不主动提问、回复慢、不用标点和emoji
     * 敷衍信号："随便"、"都行"、"看你"、"无所谓"
     * 热情信号：长句回复、主动分享、多用emoji、快速回复、主动提问
     * 生气信号：语气强硬、用"！"、反问句、冷嘲热讽
   - 不要美化对方的态度，如实识别情感

要求：
1. 仔细识别截图顶部的备注名称，判断对方与用户的关系
2. 从右侧头像的消息学习用户的真实语言风格（人称、语气词、标点、断句等）
3. 准确识别对方的情感状态，不要总是往好的方向想
4. 综合分析左侧头像的所有消息内容，可能包含多个问题或话题
5. 根据对方的情感状态和关系，生成不同风格的回复：
   - 如果对方冷淡/敷衍：可以生成"顺着说"、"略带不满"、"傲娇/嘲讽"等不同风格
   - 如果对方热情：可以生成"热情回应"、"冷静回应"、"幽默回应"等
   - 如果对方生气：可以生成"道歉安抚"、"解释说明"、"冷静处理"等
6. 结合用户的性格特点生成回复（如果用户性格直接，回复可以更直白；如果用户幽默，可以加入玩笑）
7. 生成4个不同风格的回复选项：
   - 回复1：顺着对方说，积极正面
   - 回复2：中性回应，不卑不亢
   - 回复3：逆着对方说，带点傲娇/嘲讽/不满（根据情况调整）
   - 回复4："以上都不太合适，我想自己写"（反馈选项）

请以JSON格式返回，格式如下：
{
  "extracted_text": "从截图中提取的聊天文本，格式：[对方]: 左侧头像消息内容\\n[用户]: 右侧头像消息内容",
  "chat_remark": "截图顶部显示的备注名称",
  "relationship": "推测的关系（领导/同事/朋友/父母/爱人/暧昧对象/追求对象/追求者等）",
  "context_analysis": "对聊天上下文的分析，包括：1) 对方说了什么 2) 用户之前怎么说的 3) 用户的实际语言风格观察",
  "emotion_analysis": "对方的情感状态分析（热情/冷淡/敷衍/生气/开心/焦虑等），要如实识别，不要美化",
  "intent_analysis": "分析对方想表达什么、期待什么样的回复、对话的情绪和氛围",
  "user_style_observation": "从右侧头像消息中观察到的用户实际语言风格（人称代词、语气词如噢/哦、标点、断句、emoji、常用词等）",
  "replies": [
    {
      "text": "回复内容1（顺着对方说，积极正面，严格模仿用户风格）",
      "tone": "顺从积极",
      "reasoning": "为什么这个回复适合"
    },
    {
      "text": "回复内容2（中性回应，不卑不亢）",
      "tone": "中性平和",
      "reasoning": "选择理由"
    },
    {
      "text": "回复内容3（逆着对方说，带点傲娇/嘲讽/不满，根据对方态度调整）",
      "tone": "傲娇/嘲讽/不满",
      "reasoning": "选择理由"
    },
    {
      "text": "以上都不太合适，我想自己写",
      "tone": "反馈选项",
      "reasoning": "如果前面的回复都不满意，用户可以选择此项提供反馈"
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
