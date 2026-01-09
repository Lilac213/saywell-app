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
  console.log('收到请求:', req.method, req.url);

  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('开始解析请求体...');
    const bodyText = await req.text();
    console.log('请求体大小:', bodyText.length);
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      console.error('JSON解析失败:', e);
      throw new Error('无效的JSON请求体');
    }

    const { screenshotUrl, screenshotBase64, userProfile, previousSelections = [] } = body as RequestBody;
    console.log('解析完成. URL:', screenshotUrl ? 'Yes' : 'No', 'Base64:', screenshotBase64 ? 'Yes (length: ' + screenshotBase64.length + ')' : 'No');

    const prompt = `你是一个智能情感助手。请仔细分析提供的聊天截图，识别对话角色、内容和语境，并根据"我"（用户）的画像生成回复。

    【核心原则 - 必须严格遵守】
    1. **角色识别规则（绝对准确）：**
       - **左侧头像** / **气泡尖角朝左** = **对方**（发消息的人）。
       - **右侧头像** / **气泡尖角朝右** = **我**（用户本人）。
       - **严禁**仅凭人称代词（如"我"、"你"）判断角色，必须以头像位置为准。
       - **严禁**仅凭气泡颜色判断，白色/绿色气泡都可能是任意一方（如发送图片时）。
       - 长消息可能会延伸到屏幕另一侧，但必须根据**头像起始位置**或**气泡尖角方向**判断归属。

    2. **拒绝幻觉（实事求是）：**
       - **严禁**编造截图中未出现的具体事实（如：对方问"你做什么项目？"，如果你不知道，**绝对不能**编造一个项目名称）。
       - 如果遇到需要具体事实才能回答的问题，请生成包含占位符的回复（如："主要是关于[项目名称]的..."）或生成反问/模糊回应。
       - 所有的回答必须基于截图内容、用户画像或通用常识。

    3. **对话分段与对象：**
       - 必须区分清楚哪句话是谁说的。
       - 回复应针对**对方**发出的最新有效信息，结合上下文语境。
       - **重点规则：如果对方最后一句话是明确问句（以？结尾或疑问语气），必须优先直接回答该问题，不要回避。**
       - 不要把**我**说的话误认为是**对方**说的话而进行回复。

    【用户画像】
    - 性格特点: ${JSON.stringify(userProfile.personality_traits)}
    - 语言习惯: ${JSON.stringify(userProfile.language_habits)}
    - 背景故事: ${userProfile.background_story || '无'}

    ${previousSelections.length > 0 ? `
    【用户历史偏好参考】
    ${previousSelections.slice(0, 3).map(s => `- 曾选择: "${s.selected_reply}" (场景: ${s.generated_replies[0]?.substring(0, 10)}...)`).join('\n')}
    ` : ''}

    【任务要求】
    1. **提取与分析**：
       - 准确识别对话流，按顺序理清[对方]和[我]的发言。
       - 分析对方的意图、情绪和双方关系（意图和情绪分析需丰满深入，每项约50-80字，但总字数控制在100字以内；关系判断保持简练）。
    2. **生成回复**：
       - 生成 4 个不同风格的回复建议：
         - 选项1：符合用户画像的常规/得体回复
         - 选项2：高情商/共情/温暖的回复
         - 选项3：幽默/机智/有趣的回复
         - 选项4：简洁/直接/高效的回复
       - 回复必须符合用户画像中的性格和语言习惯。

    【输出格式】
    请仅返回一个标准的 JSON 对象，不要包含 markdown 代码块标记，结构如下：
    {
      "extracted_text": "对话文字内容（按顺序标明 [对方]:... / [我]:...）",
      "context_analysis": "简练的语境分析...",
      "user_style_observation": "简练的风格观察...",
      "intent_analysis": "简练的意图分析...",
      "emotion_analysis": "简练的情绪分析...",
      "relationship": "简练的关系判断...",
      "chat_remark": "对方备注名(如有)...",
      "replies": [
        { "text": "回复1", "tone": "得体", "reasoning": "简短推荐理由" },
        { "text": "回复2", "tone": "高情商", "reasoning": "简短推荐理由" },
        { "text": "回复3", "tone": "幽默", "reasoning": "简短推荐理由" },
        { "text": "回复4", "tone": "简洁", "reasoning": "简短推荐理由" }
      ]
    }`;

    // 处理图片数据
    let imageContent: any = {};
    
    // 优先使用 URL (速度最快，传输数据最少)
    if (screenshotUrl) {
       console.log('使用图片 URL 模式:', screenshotUrl);
       // 验证 URL 是否可访问
       try {
         console.log('正在验证图片 URL 可访问性...');
         const checkRes = await fetch(screenshotUrl, { method: 'HEAD' });
         console.log('图片 URL 验证结果:', checkRes.status, checkRes.statusText);
         if (!checkRes.ok) {
           console.warn('警告: 图片 URL 返回非 200 状态码, 可能无法被 AI 读取');
         }
       } catch (e) {
         console.error('验证图片 URL 失败:', e);
       }
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
