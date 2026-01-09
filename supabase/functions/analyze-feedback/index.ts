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
    const { feedbackText, userProfileId, existingProfile } = await req.json();

    if (!feedbackText || !userProfileId || !existingProfile) {
      return new Response(
        JSON.stringify({ error: '缺少必要参数' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 构建提示词
    const prompt = `你是一个用户画像分析专家。基于用户反馈更新画像。

用户反馈：${feedbackText}
当前画像：${JSON.stringify(existingProfile)}

任务：
1. 仅当反馈明确指示新的语言习惯或性格特征时才更新。
2. 严禁过度解读。
3. 必须保留所有未变更的现有信息。

返回更新后的完整JSON画像：
{
  "personality_traits": {},
  "language_habits": {},
  "background_story": ""
}

注意：
- 输出必须是纯JSON。
- 保持内容极其简练。
- 若无明确更新点，直接返回原画像。`;

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
