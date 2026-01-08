import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { feedbackText, userProfileId, existingProfile } = await req.json();

    if (!feedbackText || !userProfileId || !existingProfile) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建提示词
    const prompt = `你是一个用户画像分析专家。用户提供了反馈，请从中提炼关键信息并更新用户画像。

用户反馈：
${feedbackText}

当前用户画像：
${JSON.stringify(existingProfile, null, 2)}

请分析用户反馈，提取以下信息：
1. 用户的语言习惯偏好（如：喜欢用什么词、语气、标点等）
2. 用户的性格特点（如：直接、委婉、幽默等）
3. 用户的沟通风格（如：正式、随意、热情等）

重要原则：
- 单次反馈不足以确定用户习惯，需要谨慎判断
- 只有当反馈内容明确、具体、有代表性时才更新
- 避免根据单个词语（如"好的"、"嗯"）就判断为口头禅
- 需要看到多次一致的表达模式才能确认为习惯
- 如果反馈内容不够充分，保持原有画像不变

请以JSON格式返回更新后的画像，格式如下：
{
  "personality_traits": {
    ...现有的性格特征（保留），
    ...从反馈中提取的新特征（仅在有充分证据时补充或更新）
  },
  "language_habits": {
    ...现有的语言习惯（保留），
    ...从反馈中提取的新习惯（仅在有充分证据时补充或更新）
  },
  "background_story": "更新后的背景故事（仅在有新的重要信息时整合）"
}

注意：
1. 保留现有画像中的所有信息
2. 只在有充分证据时补充或更新
3. 不要删除或覆盖现有信息
4. 如果反馈中没有足够的信息，保持原样
5. 宁可保守，不要过度解读单次反馈`;

    // 调用 DeepSeek API
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
      throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('DeepSeek API 返回内容为空');
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
