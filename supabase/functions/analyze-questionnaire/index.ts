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
}

Deno.serve(async (req) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { responses } = await req.json() as RequestBody;

    // 构建问卷内容
    let questionnaireText = '用户问卷回答：\n\n';
    responses.forEach((item, index) => {
      questionnaireText += `问题 ${index + 1}: ${item.question}\n`;
      questionnaireText += `回答: ${item.answer}\n\n`;
    });

    // 构建提示词
    const prompt = `你是一个用户画像分析专家。请分析以下问卷回答，提取用户的性格特征、语言习惯和背景信息。

${questionnaireText}

请以JSON格式返回分析结果，格式如下：
{
  "personality_traits": {
    "MBTI类型": "用户的MBTI类型",
    "星座": "用户的星座",
    "性格特点": "详细描述用户的性格特征",
    "沟通风格": "用户的沟通方式和风格"
  },
  "language_habits": {
    "常用词汇": ["词1", "词2", "词3"],
    "口头禅": "用户的口头禅",
    "表达方式": "详细描述用户的表达习惯",
    "语气特点": "用户的语气风格",
    "标点符号习惯": "用户使用标点符号的习惯（如：经常使用、喜欢省略号、很少使用等）",
    "断句习惯": "用户的断句方式（如：一句话说完、分多条发送、按语义断句等）",
    "emoji使用": "用户使用表情符号的频率和偏好",
    "句子长度偏好": "用户偏好的句子长度（长句/短句/混合）"
  },
  "background_story": "用户的背景故事和生活状态的简要描述，包括职业、年龄段、兴趣爱好等"
}

要求：
1. 深入分析用户的性格特征（结合MBTI、星座等信息）
2. 详细识别用户的语言习惯，特别注意：
   - 标点符号的使用频率和偏好
   - 断句方式和消息发送习惯
   - 常用词汇和口头禅
   - 表情符号的使用风格
3. 总结用户的背景信息和生活状态
4. 分析要具体、准确，便于后续生成个性化回复`;

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
