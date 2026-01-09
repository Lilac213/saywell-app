import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  screenshotUrl?: string; // 改为接收 URL
  screenshotBase64?: string; // 保留向后兼容（虽然我们主要用 URL）
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
    const { screenshotUrl, screenshotBase64, userProfile, previousSelections = [] } = await req.json() as RequestBody;

    // ... (中间的 prompt 构建代码保持不变) ...

    // 处理图片数据
    let imageContent: any = {};
    
    // 优先使用 URL (速度最快，传输数据最少)
    if (screenshotUrl) {
       console.log('使用图片 URL 模式');
       imageContent = { image_url: { url: screenshotUrl } };
    } 
    // 降级使用 Base64
    else if (screenshotBase64) {
      console.log('使用 Base64 模式');
      let imageUrl = screenshotBase64;
      if (!imageUrl.startsWith('data:')) {
        imageUrl = `data:image/webp;base64,${imageUrl}`;
      }
      imageContent = { image_url: { url: imageUrl } };
    } else {
      throw new Error('必须提供 screenshotUrl 或 screenshotBase64');
    }

    // 调用通义千问 Qwen-VL API (DashScope)
    console.log('正在调用通义千问 Qwen-VL API (qwen-vl-plus)...');
    const startTime = Date.now();

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
        model: 'qwen-vl-plus', // 🚀 切换到 Plus 模型：速度快很多，效果也足够好
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: imageContent.image_url ? 'image_url' : 'text', ...imageContent }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Qwen-VL API 调用失败:', response.status, errorText);
      throw new Error(`Qwen-VL API 错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`Qwen-VL API 调用成功，耗时: ${Date.now() - startTime}ms`);
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
