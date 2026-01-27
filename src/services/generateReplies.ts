import { callDashScope } from './dashscope';

interface GenerateRepliesParams {
  screenshotUrl?: string;
  screenshotBase64?: string;
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

export async function generateReplies({
  screenshotUrl,
  screenshotBase64,
  userProfile,
  previousSelections = []
}: GenerateRepliesParams) {
  // 处理图片数据
  let imageContent: any = {};
  
  // 优先使用 URL
  if (screenshotUrl) {
     console.log('使用图片 URL 模式:', screenshotUrl);
     // 验证 URL 是否可访问 (可选，前端环境通常不需要像后端那样严格验证)
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

  // --- 第一步：并行执行 OCR 任务 (分离顶部备注识别与对话内容识别) ---
  console.log('🚀 第一步：调用 Qwen-VL-Plus 提取对话内容 (并行任务)...');
  const extractStartTime = Date.now();

  // 任务一：顶部备注识别
  const headerPrompt = `你是一个精准的OCR助手。请只关注屏幕最顶部的区域。
  1. **目标**：识别屏幕最顶部灰色背景横条中的居中文字（如"文件传输助手"、"妈妈"、"老板"等）。
  2. **规则**：
     - 这是**用户给对方起的备注名**。
     - 只输出识别到的备注名内容，不要包含任何前缀或解释。
     - 如果没有或无法识别，请输出 "NULL"。
  `;

  // 任务二：对话内容与角色识别
  const dialoguePrompt = `你是一个精准的OCR助手。请识别图中的微信对话内容。
  请严格按照以下步骤执行识别任务：

  **目标**：识别聊天气泡中的对话内容，并区分角色。
  
  **角色判断核心规则（必须严格遵守）**：
  1. **位置判定法（铁律）**：
     - 🟢 **绿色气泡** 或 靠**右**侧 = **[我]**（用户）
     - ⚪ **白色气泡** 或 靠**左**侧 = **[对方]**
  2. **连续对话处理**：
     - 对话方可能一次发多段对话，严格根据位置判定法判断，不能根据对话轮次来判断。
     - 每一条气泡都必须**独立**根据位置判断角色。
  3. **逻辑陷阱预警**：
     - ❌ 严禁根据“谁在提问”或“语义”来判断角色。
     - ✅ **只看气泡是在左边还是右边！**
     - 忽略顶部昵称和中间时间戳。
    
  **输出格式**：
  - 按对话发生顺序输出。
  - 格式：\`[角色]：内容\`
  - 示例：
    [对方]：吃饭了吗？
    [我]：刚吃完。
  `;

  // 并行调用两个 OCR 任务
  const [headerResponse, dialogueResponse] = await Promise.all([
    callDashScope(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: headerPrompt },
            { type: imageContent.image_url ? 'image_url' : 'text', ...imageContent }
          ]
        }
      ],
      'qwen-vl-plus',
      { temperature: 0.01, top_p: 0.1 }
    ),
    callDashScope(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: dialoguePrompt },
            { type: imageContent.image_url ? 'image_url' : 'text', ...imageContent }
          ]
        }
      ],
      'qwen-vl-plus',
      { temperature: 0.01, top_p: 0.1 }
    )
  ]);

  // 处理顶部备注结果
  let extractedHeader: string | null = headerResponse.trim();
  if (extractedHeader === 'NULL' || extractedHeader.length > 20) { // 简单过滤
    extractedHeader = null;
  }
  // 清理可能的 markdown 标记或前缀
  if (extractedHeader) {
      extractedHeader = extractedHeader.replace(/^\[顶部备注\]：/,'').replace(/^备注：/,'').trim();
  }
  console.log('🏷️ 识别到顶部备注:', extractedHeader);

  // 处理对话内容结果
  let extractedText = dialogueResponse.trim();
  // 移除可能的顶部备注行（如果模型还是输出了）
  extractedText = extractedText.replace(/^\[顶部备注\]：.*(\r\n|\n|\r)?/m, '').trim();

  console.log(`✅ 提取完成，耗时: ${Date.now() - extractStartTime}ms`);
  console.log('📝 提取到的对话:', extractedText);


  // --- 第二步：基于提取文本进行分析与回复 (NLP) ---
  console.log('🚀 第二步：调用 Qwen-Plus 生成回复...');
  const analyzeStartTime = Date.now();

  const analyzePrompt = `你是一个智能情感助手。请基于以下提取的对话记录和用户画像，分析语境并生成回复。

  【对话记录】
  ${extractedText}

  【附加信息】
  - 顶部备注名: ${extractedHeader || '对方'}

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

  const analyzeContent = await callDashScope(
    [{ role: 'user', content: analyzePrompt }],
    'qwen-plus',
    {
      temperature: 0.8,
      top_p: 0.9
    }
  );

  console.log(`✅ 分析完成，耗时: ${Date.now() - analyzeStartTime}ms`);

  // 提取JSON部分
  const jsonMatch = analyzeContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('无法从AI响应中提取JSON数据');
  }

  const result = JSON.parse(jsonMatch[0]);
  
  // 合并结果
  result.extracted_text = extractedText;
  result.extracted_header = extractedHeader;
  
  // 如果识别到了顶部备注，强制覆盖 chat_remark
  if (extractedHeader) {
    result.chat_remark = extractedHeader;
  }

  return result;
}
