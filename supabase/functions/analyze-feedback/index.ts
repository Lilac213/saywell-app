import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log("Received request:", req.method, req.url);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { feedbackText, userProfileId, existingProfile, feedbackId, feedbackType } = await req.json();

    if (!feedbackText || !userProfileId || !existingProfile) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建提示词
    let typeContext = '';
    let specialInstruction = '';

    if (feedbackType) {
      const typeMap: Record<string, string> = {
        'role_confusion': '角色混淆',
        'analysis_error': '分析错误',
        'style_mismatch': '回复风格不符',
        'other': '其他问题'
      };
      typeContext = `反馈类型：${typeMap[feedbackType] || feedbackType}\n`;

      if (feedbackType === 'role_confusion') {
        specialInstruction = `
*** 特别指令 (优先级最高) ***
用户反馈遇到了“角色混淆”问题（即之前的分析可能将“对方”和“用户”搞反了）。
用户在反馈内容中提供了正确的对话文本，格式通常为 "对方：[...] 用户：[...]" 或 "Opponent: [...] User: [...]"。
请注意：
1. 冒号可能是中文（：）或英文（:）。
2. 用户可能使用“我”代替“用户”。

请严格执行以下操作：
1. 忽略之前可能错误的上下文假设。
2. 仔细解析反馈内容中的“用户/我”后面的文字，这才是用户真正的发言样本。
3. 将这些文字作为最准确的样本，重新评估用户的语言风格。
4. 检查“当前用户画像”，如果其中包含与刚才解析出的“用户发言”风格明显冲突的特征（很可能是之前因为角色搞反记录进去的），请务必修正或删除错误特征。
`;
      }
    }

    const prompt = `你是一个用户画像分析专家。用户提供了针对AI回复的反馈，请从中提炼关键信息并更新用户画像。

    【任务目标】
    根据用户提供的反馈内容，精准识别并更新用户的：
    1. **语言习惯偏好**（如：喜欢的词汇、语气、标点、表达长短等）
    2. **性格特点**（如：直接、委婉、幽默、高冷、热情等）
    3. **用户期望的回复方式**（用户希望AI以后怎么回，比如“再强硬一点”、“再温柔一点”等）

    用户反馈：
    ${typeContext}${feedbackText}

    ${specialInstruction}

    当前用户画像：
    ${JSON.stringify(existingProfile, null, 2)}

    请分析用户反馈，提取以下信息：
    1. 用户的语言习惯偏好
    2. 用户的性格特点
    3. 用户的沟通风格

    重要原则：
    - **高度重视明确的反馈**：如果用户说“我不喜欢这样回”或“我希望更...一点”，请务必反映在画像更新中。
    - **修正错误特征**：如果反馈显示现有画像中的某些特征是错误的（特别是“角色混淆”导致的问题），请立即删除或修正。
    - 单次反馈如果包含明确的指令，应优先于之前的观察结果。
    - 宁可保守，不要过度解读，但必须尊重用户的明确意图。

    请以JSON格式返回更新后的画像，格式如下：
    {
      "personality_traits": {
        ...现有的性格特征，
        ...根据反馈更新或补充的特征
      },
      "language_habits": {
        ...现有的语言习惯，
        ...根据反馈更新或补充的习惯
      },
      "background_story": "更新后的背景故事（如涉及性格和回复偏好的重大调整，请在此记录）"
    }`;

    // 调用通义千问 Qwen API (DashScope)
    console.log('正在调用通义千问 Qwen API...');
    const startTime = Date.now();

    const dashscopeKey = Deno.env.get('DASHSCOPE_API_KEY');
    if (!dashscopeKey) {
      throw new Error('未配置 DASHSCOPE_API_KEY');
    }

    // 使用 OpenAI 兼容接口调用 Qwen
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dashscopeKey}`
      },
      body: JSON.stringify({
        model: 'qwen-plus', // 使用 qwen-plus 模型，能力均衡且速度较快
        messages: [
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    console.log(`Qwen API 调用耗时: ${Date.now() - startTime}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Qwen API Error (${response.status}):`, errorText);
      throw new Error(`Qwen API 错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Qwen API Response:', JSON.stringify(data));
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Qwen API 返回内容为空');
    }

    let analysisData;
    try {
      analysisData = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析 AI 返回的 JSON 数据');
      }
    }

    // 更新用户画像
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        personality_traits: analysisData.personality_traits,
        language_habits: analysisData.language_habits,
        background_story: analysisData.background_story,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userProfileId);

    if (updateError) {
      throw updateError;
    }

    // 如果提供了 feedbackId，更新反馈状态为已处理 (tuned)
    if (feedbackId) {
      const { error: feedbackUpdateError } = await supabase
        .from('ai_feedbacks')
        .update({ 
          handle_status: 'tuned',
          handle_note: 'AI已自动根据反馈优化画像'
        })
        .eq('id', feedbackId);
      
      if (feedbackUpdateError) {
        console.error('更新反馈状态失败:', feedbackUpdateError);
        // 不阻断流程，因为画像已经更新成功了
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updatedProfile: analysisData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
