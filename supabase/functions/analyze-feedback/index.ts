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

请以JSON格式返回更新后的画像，格式如下：
{
  "personality_traits": {
    ...现有的性格特征（保留），
    ...从反馈中提取的新特征（补充或更新）
  },
  "language_habits": {
    ...现有的语言习惯（保留），
    ...从反馈中提取的新习惯（补充或更新）
  },
  "background_story": "更新后的背景故事（整合反馈信息）"
}

注意：
1. 保留现有画像中的所有信息
2. 只补充或更新反馈中明确提到的内容
3. 不要删除或覆盖现有信息
4. 如果反馈中没有相关信息，保持原样`;

    // 调用Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

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
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.statusText}`);
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
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullText += text;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    }

    // 解析AI返回的JSON
    let analysisData;
    try {
      analysisData = JSON.parse(fullText);
    } catch (error) {
      console.error('Failed to parse AI response:', fullText);
      throw new Error('AI返回格式错误');
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
