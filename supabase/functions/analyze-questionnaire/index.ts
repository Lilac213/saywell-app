import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuestionAnswer {
  question: string;
  answer: string;
}

interface RequestBody {
  responses: QuestionAnswer[];
  isUpdate?: boolean;
  existingProfile?: {
    personality_traits: any;
    language_habits: any;
    background_story: string;
  };
}

Deno.serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { responses, isUpdate, existingProfile } = await req.json() as RequestBody;

    // 构建问卷内容
    let questionnaireText = '用户问卷回答：\n\n';
    responses.forEach((item, index) => {
      questionnaireText += `问题 ${index + 1}: ${item.question}\n`;
      questionnaireText += `回答: ${item.answer}\n\n`;
    });

    // 构建提示词
    let prompt = '';
    
    if (isUpdate && existingProfile) {
      // 老用户更新画像
      prompt = `你是一个用户画像分析专家。用户想要补充或更新他们的个人画像信息。

现有画像：
性格特征：${JSON.stringify(existingProfile.personality_traits, null, 2)}
语言习惯：${JSON.stringify(existingProfile.language_habits, null, 2)}
背景故事：${existingProfile.background_story}

用户补充的信息：
${questionnaireText}

请分析用户想要更新的内容，并以JSON格式返回更新后的画像。注意：
1. 只更新用户明确提到的部分
2. 保留未提及的原有信息
3. 如果用户提到了新的语言习惯，合并到现有习惯中

返回格式：
{
  "personality_traits": {
    "性别": "用户的性别（如果提到）",
    "MBTI类型": "用户的MBTI类型（如果提到）",
    "星座": "用户的星座（如果提到）",
    "性格特点": "更新后的性格特征",
    "沟通风格": "更新后的沟通风格"
  },
  "language_habits": {
    "常用词汇": ["更新后的常用词"],
    "口头禅": "更新后的口头禅",
    "表达方式": "更新后的表达习惯",
    "语气特点": "更新后的语气风格",
    "标点符号习惯": "更新后的标点习惯",
    "断句习惯": "更新后的断句方式",
    "emoji使用": "更新后的emoji使用习惯",
    "句子长度偏好": "更新后的句子长度偏好"
  },
  "background_story": "更新后的背景故事"
}`;
    } else {
      // 新用户完整问卷
      prompt = `你是一个用户画像分析专家。请分析以下问卷回答，提取用户的性格特征和语言习惯。

${questionnaireText}

请以JSON格式返回分析结果，格式如下：
{
  "personality_traits": {
    "性别": "用户的性别",
    "星座": "用户的星座",
    "年龄段": "用户的年龄段",
    "性格特点": "根据用户描述的性格特征进行总结",
    "特别关心的人": {
      "备注名称": "用户设定的备注名（如果有）",
      "关系": "与用户的关系（如果有）"
    }
  },
  "language_habits": {
    "发消息习惯": "用户的发消息习惯（长消息/短消息/混合）",
    "标点符号习惯": "用户使用标点符号的习惯",
    "emoji使用": "用户使用emoji的频率和风格",
    "口头禅": "用户的口头禅或常用词汇"
  },
  "background_story": "简要总结用户的基本信息、性格特点和语言习惯"
}

注意：
1. 根据问卷回答准确提取语言习惯信息
2. 如果用户设定了特别关心的人，记录备注名称和关系
3. 性格特点要基于用户的自我描述进行总结
4. 语言习惯要详细记录，包括发消息习惯、标点、emoji、口头禅等`;
    }

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
              parts: [{ text: prompt }],
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
