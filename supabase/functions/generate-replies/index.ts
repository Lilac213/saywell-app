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

    const dashscopeKey = Deno.env.get('DASHSCOPE_API_KEY');
    if (!dashscopeKey) {
      throw new Error('未配置 DASHSCOPE_API_KEY');
    }

    // --- 第一步：精准提取对话内容 (OCR) ---
    console.log('🚀 第一步：调用 Qwen-VL-Plus 提取对话内容...');
    const extractStartTime = Date.now();

    const extractPrompt = `你是一个精准的OCR助手。请识别图中的微信对话内容。
    【核心原则 - 必须严格遵守】
    1. **角色识别规则（最高优先级 - 针对微信/聊天软件UI）：**
       - **颜色与位置绑定**：
         - 🟩 **绿色气泡** / 靠**右**侧 = **[我]**（用户）
         - ⬜ **白色气泡** / 靠**左**侧 = **[对方]**
       - **排除顶部干扰**：
         - 屏幕最顶部的居中文字（如"文件传输助手"等）是**对方昵称**，**绝对不是**对话内容，请直接忽略。
         - 中间的灰色小字是**时间戳**，请忽略。
       - **位置判定法**：
         - 即使无法识别颜色，**凡是靠屏幕右侧的文字/气泡，统统属于[我]。**
         - **凡是靠屏幕左侧的文字/气泡，统统属于[对方]。**
       - **逻辑陷阱预警**：
         - ❌ 严禁根据“谁在提问”来判断角色（我也会提问）。
         - ❌ 严禁根据“谁在回答”来判断角色。
         - ❌ 严禁根据人称代词（你/我）来判断角色。
         - ❌ 严禁根据语义来判断角色。
         - ✅ **只看气泡是在左边还是右边！**

    【输出格式】
    请严格按对话顺序输出文本，不要输出任何其他解释、前言或Markdown标记。格式如下：
    [对方]：内容...
    [我]：内容...
    [对方]：内容...`;

    const extractResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dashscopeKey}`
      },
      body: JSON.stringify({
        model: 'qwen-vl-plus',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: extractPrompt },
              { type: imageContent.image_url ? 'image_url' : 'text', ...imageContent }
            ]
          }
        ],
        temperature: 0.01, // ❄️ 极低温度，保证 OCR 准确性
        top_p: 0.1
      })
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      throw new Error(`OCR 提取失败: ${extractResponse.status} - ${errorText}`);
    }

    const extractData = await extractResponse.json();
    const extractedText = extractData.choices?.[0]?.message?.content?.trim();
    console.log(`✅ 提取完成，耗时: ${Date.now() - extractStartTime}ms`);
    console.log('📝 提取到的对话:', extractedText);

    if (!extractedText) {
      throw new Error('OCR 提取结果为空');
    }

    // --- 第二步：基于提取文本进行分析与回复 (NLP) ---
    console.log('🚀 第二步：调用 Qwen-Plus 生成回复...');
    const analyzeStartTime = Date.now();

    const analyzePrompt = `你是一个智能情感助手。请基于以下提取的对话记录和用户画像，分析语境并生成回复。

    【对话记录】
    ${extractedText}

    【用户画像】
    - 性格特点: ${JSON.stringify(userProfile.personality_traits)}
    - 语言习惯: ${JSON.stringify(userProfile.language_habits)}
    - 背景故事: ${userProfile.background_story || '无'}

    ${previousSelections.length > 0 ? `
    【用户历史偏好参考】
    ${previousSelections.slice(0, 3).map(s => `- 曾选择: "${s.selected_reply}" (场景: ${s.generated_replies[0]?.substring(0, 10)}...)`).join('\n')}
    ` : ''}

    【任务要求】
    1. **分析**：
       - 分析对方的意图、情绪和双方关系（意图和情绪分析需丰满深入，每项约50-80字，但总字数控制在100字以内；关系判断保持简练）。
       - 提取或推测对方的备注名（chat_remark），如果对话中没有体现，可以根据语境推测（如“妈妈”、“老板”），实在无法推测则留空。
    2. **生成回复**：
       - 生成 4 个不同风格的回复建议：
         - 选项1：符合用户画像的常规/得体回复
         - 选项2：高情商/共情/温暖的回复
         - 选项3：幽默/机智/有趣的回复
         - 选项4：简洁/直接/高效的回复
       - 回复必须符合用户画像中的性格和语言习惯。
       - **重点规则：如果对方最后一句话是明确问句，必须优先直接回答该问题。**

    【输出格式】
    请仅返回一个标准的 JSON 对象，不要包含 markdown 代码块标记，结构如下：
    {
      "context_analysis": "简练的语境分析...",
      "user_style_observation": "简练的风格观察...",
      "intent_analysis": "简练的意图分析...",
      "emotion_analysis": "简练的情绪分析...",
      "relationship": "简练的关系判断...",
      "chat_remark": "对方备注名...",
      "replies": [
        { "text": "回复1", "tone": "得体", "reasoning": "简短推荐理由" },
        { "text": "回复2", "tone": "高情商", "reasoning": "简短推荐理由" },
        { "text": "回复3", "tone": "幽默", "reasoning": "简短推荐理由" },
        { "text": "回复4", "tone": "简洁", "reasoning": "简短推荐理由" }
      ]
    }`;

    const analyzeResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dashscopeKey}`
      },
      body: JSON.stringify({
        model: 'qwen-plus', // 🧠 使用文本模型进行深度思考
        messages: [
          {
            role: 'user',
            content: analyzePrompt
          }
        ],
        temperature: 0.8, // 🔥 较高温度，激发创意
        top_p: 0.9 // 🌈 较高的 top_p，增加多样性
      })
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      throw new Error(`AI 分析失败: ${analyzeResponse.status} - ${errorText}`);
    }

    const analyzeData = await analyzeResponse.json();
    console.log(`✅ 分析完成，耗时: ${Date.now() - analyzeStartTime}ms`);
    const analyzeContent = analyzeData.choices?.[0]?.message?.content;

    if (!analyzeContent) {
      throw new Error('AI 分析返回内容为空');
    }

    // 提取JSON部分
    const jsonMatch = analyzeContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从AI响应中提取JSON数据');
    }

    const result = JSON.parse(jsonMatch[0]);
    
    // 合并结果：将第一步提取的文本加入最终结果
    result.extracted_text = extractedText;

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
