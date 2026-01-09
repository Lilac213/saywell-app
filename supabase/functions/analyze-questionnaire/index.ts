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
  console.log("Received request:", req.method, req.url);

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

    // 调用 DeepSeek API
    console.log('正在调用 DeepSeek API (deepseek-chat)...');
    const startTime = Date.now();
    
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!deepseekKey) {
      throw new Error('未配置 DEEPSEEK_API_KEY');
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DeepSeek API 调用失败:', response.status, errorText);
      throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`DeepSeek API 调用成功，耗时: ${Date.now() - startTime}ms`);
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Qwen API 返回内容为空');
    }

    // 尝试解析 JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      // 如果直接解析失败，尝试提取 JSON 部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析 AI 返回的 JSON 数据');
      }
    }

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
