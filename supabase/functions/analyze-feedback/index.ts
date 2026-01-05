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
            } catch {
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

    const analysisData = JSON.parse(jsonMatch[0]);

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
