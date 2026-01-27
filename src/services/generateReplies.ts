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
  1. **气泡箭头判定法（绝对标准）**：
     - 🟢 **绿色气泡**：必须观察气泡一侧是否有小三角箭头。如果有**指向右侧头像**的箭头，或者气泡本身是绿色的，判定为 **[我]**（用户）。
     - ⚪ **白色气泡**：必须观察气泡一侧是否有小三角箭头。如果有**指向左侧头像**的箭头，或者气泡本身是白色的，判定为 **[对方]**。
     - **注意**：即使用户发出的内容很长（占满屏幕），只要气泡背景是**绿色**，或者箭头指向**右边**的头像，就一定是**[我]**。
  2. **位置辅助判定**：
     - 只有在无法看清气泡颜色和箭头时，才使用“靠左为对方，靠右为我”的规则。
     - 但需注意，长文本可能会横跨屏幕，此时必须优先依据**颜色（绿/白）**和**箭头指向**。
  3. **连续对话处理**：
     - 对话方可能一次发多段对话，每一条气泡都必须**独立**根据颜色和箭头判断角色。
     - 严禁根据对话轮次交替来猜测。
  4. **逻辑陷阱预警**：
     - ❌ 严禁根据“谁在提问”或“语义”来判断角色。
     - ✅ **只看视觉特征：颜色（绿vs白）和箭头指向！**
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

  // 识别特别关心对象 (用户预设)
  const specialContacts = (userProfile.personality_traits?.special_contacts as Array<{name: string, relation: string}>) || [];
  let matchedSpecialContact = null;
  if (extractedHeader) {
    matchedSpecialContact = specialContacts.find(c => 
      c.name === extractedHeader || 
      extractedHeader?.includes(c.name) || 
      c.name.includes(extractedHeader!)
    );
    if (matchedSpecialContact) {
      console.log('❤️ 匹配到用户预设特别关心对象:', matchedSpecialContact.name);
    }
  }

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
  - 用户预设特别关心: ${matchedSpecialContact ? `是 (预设关系: ${matchedSpecialContact.relation})` : '否'}

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
  2. **特别关心对象检测与策略（新增核心任务）**：
     - **检测**：基于备注名（如亲属称谓、亲密昵称、重要职级）和对话内容，判断对方是否为用户的“特别关心对象”。
     - **优先级规则**：如果【用户预设特别关心】为“是”，则**直接认定**为特别关心对象，且关系类型直接使用用户预设的 "${matchedSpecialContact?.relation}"，无需再次猜测。
     - **特殊反馈提取**：若是特别关心对象，请结合用户画像，提取或推测用户对该对象的特殊对待模式。
     - **风格强制映射规则**：
       - 若是【家人/亲属】：生成回复必须**温馨、充满关怀**。
       - 若是【暧昧对象/伴侣】：生成回复必须**有氛围感、暧昧、拉扯**。
       - 若是【职场人物/客户】：生成回复必须**非常正式、专业、严谨**。
       - **关键约束**：以上风格必须在**符合用户人物画像**的前提下执行！例如：如果用户是“高冷”人设，即使回复家人也要体现“高冷下的温馨”；如果用户是“逗比”人设，回复职场人物也要体现“得体中的活泼”（除非绝对不合适）。
  3. **特征提取 (L2 Layer)**：
     - 请根据对话内容，精准判断以下特征：
       - 场景 (scenario)
       - 关系类型 (relationship_type)
       - 意图类别 (intent_category)
       - 情绪状态 (emotion_primary, emotion_type)
       - 各项数值指标 (0-1之间)
  4. **生成回复**：
     - 生成 4 个回复建议。
     - **如果是特别关心对象**：所有 4 个回复都必须遵循上述“风格强制映射规则”，但可以在具体语气上有所微调（如：更委婉 vs 更直接）。
     - **如果不是特别关心对象**，则按以下默认风格生成：
       - 选项1：符合用户画像的常规/得体回复
       - 选项2：高情商/共情/温暖的回复
       - 选项3：幽默/机智/有趣的回复
       - 选项4：简洁/直接/高效的回复
     - **通用规则**：
       - 回复必须符合用户画像中的性格和语言习惯。
       - 如果对方最后一句话是明确问句，必须优先直接回答该问题。
       - **tone 字段必须简练**：请使用 2-6 个字的描述（如“温馨关怀”、“暧昧拉扯”、“正式专业”），不要长篇大论。

  【输出格式】
  请仅返回一个标准的 JSON 对象，不要包含 markdown 代码块标记，结构如下：
  {
    "context_analysis": "简练的语境分析...",
    "user_style_observation": "简练的风格观察...",
    "intent_analysis": "简练的意图分析...",
    "emotion_analysis": "简练的情绪分析...",
    "relationship": "简练的关系判断...",
    "chat_remark": "对方备注名...",
    "is_special_care": true, // 是否为特别关心对象
    "special_care_analysis": {
        "reason": "判断为特别关心对象的理由...",
        "relationship_category": "关系分类 (可选值: family, ambiguous, workplace, other)",
        "style_guideline": "应用的风格指导原则..."
    },
    "features": {
        "scenario": "场景类型 (可选值: 恋爱, 职场, 朋友, 家庭, 其他)",
        "relationship_type": "关系类型 (可选值: 暧昧, 上下级, 同事, 朋友, 亲人, 陌生人, 其他)",
        "intent_category": "意图类别 (可选值: share, seek_support, seek_advice, test_boundary, express_dissatisfaction, conflict, coordination, casual_chat, other)",
        "intent_strength": 0.8, // 意图强度 0-1
        "emotion_primary": "主情绪 (可选值: positive, neutral, negative)",
        "emotion_type": "具体情绪 (可选值: joy, excitement, relief, sadness, anxiety, anger, disappointment, embarrassment, other)",
        "emotion_intensity": 0.8, // 情绪强度 0-1
        "sarcasm": false, // 是否反讽
        "humor": false, // 是否幽默
        "indirectness": 0.2, // 委婉程度 0-1
        "emotional_volatility": 0.1, // 情绪波动程度 0-1
        "recommended_reply_style": "推荐回复风格 (可选值: 共情, 理性, 轻松, 克制, 幽默, 直接, 其他)"
    },
    "replies": [
      { "text": "回复1", "tone": "风格描述", "reasoning": "简短推荐理由" },
      { "text": "回复2", "tone": "风格描述", "reasoning": "简短推荐理由" },
      { "text": "回复3", "tone": "风格描述", "reasoning": "简短推荐理由" },
      { "text": "回复4", "tone": "风格描述", "reasoning": "简短推荐理由" }
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
