# 智能回复助手 - 完整需求文档

## 1. 应用概述

### 1.1 应用名称
**好好说 · SayWell**

### 1.2 应用类型
Web应用（H5/移动端优先，兼容桌面端）

### 1.3 应用描述
一款基于AI的智能聊天回复助手，通过上传聊天记录截图快速生成个性化回复建议，帮助用户在社交场景中更高效地沟通。应用会学习用户的语言习惯和性格特点，提供符合用户风格的回复选项。

---

## 2. 技术栈

### 2.1 前端技术
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件库**: shadcn/ui (基于Radix UI)
- **样式**: Tailwind CSS
- **路由**: React Router v6
- **状态管理**: React Context + Hooks
- **表单处理**: React Hook Form + Zod
- **图标**: Lucide React

### 2.2 后端技术
- **数据库**: Supabase (PostgreSQL)
- **存储**: Supabase Storage
- **Edge Functions**: Deno (部署在Supabase)
- **AI服务**: Google Gemini 2.5 Flash API

### 2.3 关键依赖
```json
{
  "@supabase/supabase-js": "^2.x",
  "@hookform/resolvers": "^5.2.2",
  "react-hook-form": "^7.x",
  "zod": "^3.x",
  "lucide-react": "^0.x",
  "tailwindcss": "^3.x"
}
```

---

## 3. 设计系统

### 3.1 配色方案
- **主色调**: 浅蓝色系 (HSL: 210, 100%, 95% - 210, 100%, 50%)
- **次要色**: 紫色系 (HSL: 270, 70%, 60%)
- **强调色**: 粉色系 (HSL: 330, 80%, 70%)
- **背景色**: 白色 (#FFFFFF)
- **文字色**: 深灰色 (HSL: 0, 0%, 20%)
- **边框色**: 浅灰色 (HSL: 0, 0%, 90%)

### 3.2 设计风格
- **布局**: 卡片式布局，清晰的视觉层次
- **圆角**: 8px (小元素), 12px (中等元素), 16px-24px (大卡片)
- **阴影**: 轻微阴影增强层次感
- **图标**: 线性风格，统一使用Lucide图标
- **动画**: 
  - 页面弹出: 从下向上滑入
  - 球体: 上下浮动动画 (animate-float)
  - 渐变文字: gradient-text类
  - 按钮悬停: 浅灰色渐变 (#E5E7EB → #D1D5DB)

### 3.3 响应式设计
- **移动端优先**: 默认样式针对移动端
- **断点**: 仅使用 `xl` 断点 (≥1280px) 用于桌面布局
- **导航栏高度**: h-12 (48px)
- **Logo尺寸**: w-7 h-7 (28px)

---

## 4. 数据库设计

### 4.1 表结构

#### 4.1.1 user_profiles (用户画像表)
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  email TEXT,
  username TEXT,
  phone TEXT,
  role user_role DEFAULT 'user',
  personality_traits JSONB DEFAULT '{}',
  language_habits JSONB DEFAULT '{}',
  background_story TEXT,
  questionnaire_completed BOOLEAN DEFAULT false
);
```

**字段说明**:
- `personality_traits`: 存储性格特征 (JSON格式)
- `language_habits`: 存储语言习惯 (JSON格式)
- `background_story`: 用户背景故事文本
- `questionnaire_completed`: 是否完成初始问卷

#### 4.1.2 chat_sessions (聊天会话表)
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  screenshot_url TEXT NOT NULL,
  extracted_text TEXT,
  context JSONB DEFAULT '{}',
  user_style_observation TEXT
);
```

**字段说明**:
- `screenshot_url`: 上传的截图URL
- `extracted_text`: AI提取的聊天文本
- `context`: 聊天上下文信息 (JSON格式)
- `user_style_observation`: AI观察到的用户风格

#### 4.1.3 reply_selections (回复选择记录表)
```sql
CREATE TABLE reply_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID REFERENCES chat_sessions(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  generated_replies JSONB NOT NULL,
  selected_reply TEXT NOT NULL,
  selection_index INTEGER NOT NULL
);
```

**字段说明**:
- `generated_replies`: 所有生成的回复选项 (JSON数组)
- `selected_reply`: 用户选择的回复文本
- `selection_index`: 用户选择的回复索引

#### 4.1.4 error_logs (错误日志表)
```sql
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  error_message TEXT NOT NULL,
  error_details JSONB,
  page_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 RLS策略
- 所有表启用RLS (Row Level Security)
- 用户只能访问自己的数据
- 使用 `auth.uid()` 进行权限控制

---

## 5. 核心功能模块

### 5.1 首页 (HomePage)

#### 5.1.1 页面路径
`/`

#### 5.1.2 页面元素
1. **导航栏**
   - Logo图片 (w-7 h-7, rounded-lg)
   - 应用名称: "好好说 · SayWell" (text-base font-bold)
   - 个人画像图标按钮 (右上角)

2. **主视觉区域**
   - 渐变球体 (w-24 h-24 xl:w-32 xl:h-32)
   - 动画: 上下浮动 (animate-float)
   - 欢迎文字: "你好，朋友！"
   - 副标题: "今天我能帮你什么？"

3. **提示信息卡片** (仅未完成问卷时显示)
   - 布局: flex横向布局
   - 内容: "完善您的个性画像 完成问卷后，AI将更好地理解您的沟通风格"
   - 按钮: "立即完成" (跳转到问卷页)
   - 样式: bg-accent/10, rounded-2xl, border

4. **上传区域**
   - 拖拽上传或点击上传
   - 支持的格式: PNG, JPG, JPEG, WEBP
   - 文件大小限制: 5MB
   - 上传后显示预览图
   - 操作按钮:
     - "重新上传" (X图标)
     - "生成回复建议" (主按钮)

5. **历史记录入口**
   - 显示最近3条聊天记录
   - 每条记录显示:
     - 截图缩略图
     - 提取的文本预览 (最多50字)
     - 时间戳
   - 点击跳转到对应的回复页面
   - "查看全部历史" 按钮

#### 5.1.3 交互流程
1. 用户上传聊天截图
2. 图片上传到Supabase Storage
3. 调用 `generate-replies` Edge Function
4. AI分析截图并生成回复建议
5. 跳转到回复建议页面

#### 5.1.4 错误处理
- 上传失败: 显示友好提示 "上传遇到问题，请稍后再试一次"
- 生成失败: 显示友好提示 "生成遇到问题，请稍后再试一次"
- 错误记录到 `error_logs` 表

---

### 5.2 问卷页 (QuestionnairePage)

#### 5.2.1 页面路径
`/questionnaire`

#### 5.2.2 问卷题目

**新用户问卷** (11题):
1. 您是第一次使用本应用吗？ (单选)
   - 是，我是新用户
   - 否，我想补充或更新我的画像

2. 你的性别是？ (单选)
   - 男生 / 女生 / 其他

3. 你的星座是？ (单选)
   - 12星座选项

4. 你的MBTI是？ (单选)
   - 16种MBTI类型 + "不清楚"

5. 你的年龄段是？ (单选)
   - 18岁以下 / 18-25岁 / 26-35岁 / 36-45岁 / 45岁以上

6. 平时你是个怎样的人？ (多选)
   - 性格开朗 / 比较内向 / 说话直接 / 温和委婉 / 幽默风趣 / 认真严谨 / 随和自然 / 其他

7. 请描述您的其他性格特点 (文本框，条件显示)
   - 仅当选择"其他"时显示

8. 你平时发消息的习惯是？ (单选)
   - 喜欢一次发完，一条长消息
   - 习惯分成多条短消息发送
   - 看情况，有时长有时短

9. 你使用标点符号的习惯是？ (单选)
   - 经常使用标点，规范完整
   - 偶尔使用，主要用句号和问号
   - 很少使用标点符号
   - 喜欢用省略号...
   - 喜欢用感叹号！表达情绪
   - 其他

10. 你经常使用表情符号或emoji吗？ (单选)
    - 经常使用，几乎每句都有😊
    - 偶尔使用，表达情绪时用
    - 很少使用，只在特定场合
    - 从不使用，纯文字交流

11. 你有什么特殊的口头禅或常用词汇吗？ (文本框)
    - 例如：哈哈、嗯嗯、好的、没问题、确实、hhh、噢、哦等

12. 你是否要设定特别关心的人？ (单选)
    - 否，暂不设定
    - 是，我要设定

13. 请输入TA在你这里的备注名称 (文本框，条件显示)
    - 例如：老板、小王、妈妈、宝贝等

14. TA跟你的关系是？ (文本框，条件显示)
    - 例如：领导、同事、朋友、父母、爱人、暧昧对象、追求对象、追求者等

**老用户更新问卷** (1题):
1. 请输入您想补充或更新的个人信息 (文本框)
   - 例如：我最近喜欢用"hhh"表示笑，或者我现在说话更直接了等

#### 5.2.3 页面元素
1. **导航栏**
   - Logo + 应用名称
   - 个人画像图标按钮

2. **欢迎区域**
   - 标题: "欢迎使用好好说" (新用户) / "更新您的画像" (老用户)
   - 副标题: "让我们先了解一下您" / "告诉我们您想补充或更新的信息"
   - 说明: "以便为您提供更个性化的回复建议"

3. **问卷卡片**
   - 进度条 (显示当前进度)
   - 问题编号和总数
   - 问题文本
   - 输入控件 (根据题型):
     - 单选: Radio Group
     - 多选: Checkbox Group
     - 文本: Input
     - 长文本: Textarea
   - 导航按钮:
     - "上一题" (第一题时禁用)
     - "下一题" / "提交" (最后一题)

#### 5.2.4 交互流程
1. 用户填写问卷
2. 点击"提交"按钮
3. 调用 `analyze-questionnaire` Edge Function
4. AI分析问卷并生成用户画像
5. 保存到 `user_profiles` 表
6. 显示成功提示并跳转到首页

#### 5.2.5 AI分析逻辑
- 提取性格特征 → `personality_traits` (JSONB)
- 提取语言习惯 → `language_habits` (JSONB)
- 生成背景故事 → `background_story` (TEXT)
- 标记问卷完成 → `questionnaire_completed = true`

#### 5.2.6 错误处理
- 分析失败: "分析遇到问题，请稍后再试一次"
- 提交失败: "提交遇到问题"
- 错误记录到 `error_logs` 表

---

### 5.3 回复建议页 (RepliesPage)

#### 5.3.1 页面路径
`/replies/:sessionId`

#### 5.3.2 页面元素
1. **导航栏**
   - 返回按钮 (返回首页)
   - Logo + 应用名称
   - 个人画像图标按钮

2. **聊天截图区域**
   - 显示上传的截图
   - 可点击放大查看

3. **提取的文本区域**
   - 标题: "识别的聊天内容"
   - 显示AI提取的文本
   - 可折叠/展开

4. **回复建议卡片** (3-5个)
   - 回复文本
   - 情绪标签 (Badge)
     - 最大宽度: max-w-[120px]
     - 超出截断: truncate
   - 操作按钮:
     - "复制" (Copy图标)
     - 复制成功后显示 "已复制" (Check图标)
   - 点击卡片选中效果

5. **反馈区域** (选中回复后显示)
   - 标题: "这个回复符合您的风格吗？"
   - 按钮:
     - "很符合" (记录选择)
     - "不太符合" (记录选择)
   - 文本框: "告诉我们您的想法" (可选)
   - "提交反馈" 按钮

#### 5.3.3 回复生成逻辑
1. 调用 `generate-replies` Edge Function
2. 传入参数:
   - 截图URL
   - 用户画像 (personality_traits, language_habits, background_story)
3. AI分析:
   - 识别聊天内容
   - 理解对话上下文
   - 生成3-5个符合用户风格的回复
   - 为每个回复添加情绪标签
4. 返回结果:
   ```json
   {
     "extractedText": "识别的文本",
     "replies": [
       {
         "text": "回复内容",
         "emotion": "情绪标签",
         "reasoning": "生成理由"
       }
     ]
   }
   ```

#### 5.3.4 反馈学习逻辑
1. 用户选择回复并提交反馈
2. 记录到 `reply_selections` 表
3. 调用 `analyze-feedback` Edge Function
4. AI分析反馈并更新用户画像
5. 更新 `user_profiles` 表

**AI更新策略** (保守更新):
- 单次反馈不足以确定习惯
- 只在有充分证据时更新
- 避免根据单个词语判断口头禅
- 需要多次一致的表达模式才确认
- 保留现有画像信息，只补充或更新

---

### 5.4 个人画像页 (ProfilePage)

#### 5.4.1 页面路径
`/profile`

#### 5.4.2 页面元素
1. **导航栏**
   - 返回按钮
   - Logo + 应用名称
   - 个人画像图标 (当前页面)

2. **画像卡片**
   - 标题: "我的个性画像"
   - 图标: Sparkles

3. **性格特征区域**
   - 标题: "性格特征"
   - 显示 `personality_traits` 的所有键值对
   - 每个特征显示为 Badge

4. **语言习惯区域**
   - 标题: "语言习惯"
   - 显示 `language_habits` 的所有键值对
   - 每个习惯显示为文本列表

5. **背景故事区域**
   - 标题: "背景故事"
   - 显示 `background_story` 文本

6. **操作按钮**
   - "更新画像" (跳转到问卷页)
   - 图标: RefreshCw

#### 5.4.3 数据显示
- 如果未完成问卷: 显示提示 "您还未完成问卷，请先完成问卷"
- 如果已完成问卷: 显示完整画像信息

---

### 5.5 历史记录页 (HistoryPage)

#### 5.5.1 页面路径
`/history`

#### 5.5.2 页面元素
1. **导航栏**
   - 返回按钮
   - 标题: "历史记录"

2. **记录列表**
   - 按时间倒序排列
   - 每条记录显示:
     - 截图缩略图
     - 提取的文本预览 (最多100字)
     - 时间戳 (相对时间)
     - 点击跳转到对应的回复页面

3. **分页控件**
   - 每页显示10条
   - 上一页/下一页按钮

4. **空状态**
   - 无历史记录时显示: "暂无历史记录"
   - 提示: "上传聊天截图开始使用"

---

## 6. Edge Functions

### 6.1 analyze-questionnaire

#### 6.1.1 功能
分析用户问卷答案，生成用户画像

#### 6.1.2 输入参数
```typescript
{
  answers: Record<string, any>,  // 问卷答案
  isNewUser: boolean,            // 是否新用户
  existingProfile?: {            // 现有画像 (老用户)
    personality_traits: Record<string, any>,
    language_habits: Record<string, any>,
    background_story: string
  }
}
```

#### 6.1.3 AI提示词
```
你是一个用户画像分析专家。请根据用户的问卷答案，分析并生成用户的个性画像。

问卷答案：
{answers}

请提取以下信息：
1. 性格特征 (personality_traits)
2. 语言习惯 (language_habits)
3. 背景故事 (background_story)

返回JSON格式：
{
  "personality_traits": { ... },
  "language_habits": { ... },
  "background_story": "..."
}
```

#### 6.1.4 输出结果
```typescript
{
  personality_traits: Record<string, any>,
  language_habits: Record<string, any>,
  background_story: string
}
```

---

### 6.2 generate-replies

#### 6.2.1 功能
分析聊天截图，生成个性化回复建议

#### 6.2.2 输入参数
```typescript
{
  screenshotUrl: string,         // 截图URL
  userProfile: {                 // 用户画像
    personality_traits: Record<string, any>,
    language_habits: Record<string, any>,
    background_story: string
  }
}
```

#### 6.2.3 AI提示词
```
你是一个智能回复助手。请分析聊天截图，理解对话内容和上下文，然后根据用户的个性画像生成3-5个符合用户风格的回复建议。

用户画像：
性格特征：{personality_traits}
语言习惯：{language_habits}
背景故事：{background_story}

要求：
1. 识别截图中的聊天文本
2. 理解对话上下文和情绪
3. 生成3-5个回复选项
4. 每个回复要符合用户的语言习惯和性格特点
5. 为每个回复添加情绪标签

返回JSON格式：
{
  "extractedText": "识别的文本",
  "replies": [
    {
      "text": "回复内容",
      "emotion": "情绪标签",
      "reasoning": "生成理由"
    }
  ]
}
```

#### 6.2.4 输出结果
```typescript
{
  extractedText: string,
  replies: Array<{
    text: string,
    emotion: string,
    reasoning: string
  }>
}
```

---

### 6.3 analyze-feedback

#### 6.3.1 功能
分析用户反馈，更新用户画像

#### 6.3.2 输入参数
```typescript
{
  feedbackText: string,          // 用户反馈文本
  userProfileId: string,         // 用户画像ID
  existingProfile: {             // 现有画像
    personality_traits: Record<string, any>,
    language_habits: Record<string, any>,
    background_story: string
  }
}
```

#### 6.3.3 AI提示词 (保守更新策略)
```
你是一个用户画像分析专家。用户提供了反馈，请从中提炼关键信息并更新用户画像。

用户反馈：
{feedbackText}

当前用户画像：
{existingProfile}

重要原则：
- 单次反馈不足以确定用户习惯，需要谨慎判断
- 只有当反馈内容明确、具体、有代表性时才更新
- 避免根据单个词语（如"好的"、"嗯"）就判断为口头禅
- 需要看到多次一致的表达模式才能确认为习惯
- 如果反馈内容不够充分，保持原有画像不变

请以JSON格式返回更新后的画像：
{
  "personality_traits": { ... },
  "language_habits": { ... },
  "background_story": "..."
}

注意：
1. 保留现有画像中的所有信息
2. 只在有充分证据时补充或更新
3. 不要删除或覆盖现有信息
4. 如果反馈中没有足够的信息，保持原样
5. 宁可保守，不要过度解读单次反馈
```

#### 6.3.4 输出结果
```typescript
{
  personality_traits: Record<string, any>,
  language_habits: Record<string, any>,
  background_story: string
}
```

---

## 7. 用户流程

### 7.1 新用户首次使用
1. 访问首页
2. 看到"完善您的个性画像"提示
3. 点击"立即完成"跳转到问卷页
4. 填写11题问卷
5. 提交问卷，AI生成画像
6. 返回首页，开始使用

### 7.2 上传截图获取回复
1. 在首页上传聊天截图
2. 点击"生成回复建议"
3. AI分析截图并生成回复
4. 跳转到回复建议页
5. 查看3-5个回复选项
6. 选择合适的回复并复制
7. (可选) 提交反馈帮助AI学习

### 7.3 更新个人画像
1. 访问个人画像页
2. 查看当前画像信息
3. 点击"更新画像"
4. 填写更新问卷 (1题)
5. 提交更新，AI更新画像
6. 返回画像页查看更新结果

### 7.4 查看历史记录
1. 在首页点击"查看全部历史"
2. 查看所有历史聊天记录
3. 点击任意记录查看详情
4. 可以重新查看之前的回复建议

---

## 8. 关键特性

### 8.1 个性化学习
- 通过问卷建立初始画像
- 通过反馈持续优化画像
- 保守更新策略，避免过度学习

### 8.2 智能回复生成
- 基于用户画像生成回复
- 符合用户语言习惯
- 匹配用户性格特点
- 提供多样化选项

### 8.3 用户体验优化
- 移动端优先设计
- 简洁清晰的界面
- 流畅的动画效果
- 友好的错误提示
- 快速的响应速度

### 8.4 数据安全
- RLS权限控制
- 用户数据隔离
- 错误日志记录
- 隐私保护

---

## 9. UI组件规范

### 9.1 导航栏
```tsx
<header className="border-b border-border/10 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
  <div className="container mx-auto px-6 h-12 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <img src={logoImage} alt="好好说Logo" className="w-7 h-7 rounded-lg object-cover" />
      <h1 className="text-base font-bold">
        好好说 · <span className="font-normal text-muted-foreground">SayWell</span>
      </h1>
    </div>
    <Button variant="ghost" size="icon" className="rounded-full">
      <User className="w-5 h-5" />
    </Button>
  </div>
</header>
```

### 9.2 渐变球体
```tsx
<div className="w-24 h-24 xl:w-32 xl:h-32 gradient-sphere animate-float" />
```

CSS:
```css
.gradient-sphere {
  background: linear-gradient(135deg, 
    hsl(var(--primary)) 0%, 
    hsl(var(--secondary)) 50%, 
    hsl(var(--accent)) 100%);
  border-radius: 50%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}
```

### 9.3 按钮样式
```css
.button-dark {
  background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)));
  color: white;
  transition: all 0.3s ease;
}

.button-dark:hover {
  background: linear-gradient(135deg, #E5E7EB, #D1D5DB);
}
```

### 9.4 卡片样式
```tsx
<Card className="bg-white rounded-3xl shadow-lg border border-border/10">
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述</CardDescription>
  </CardHeader>
  <CardContent>
    内容
  </CardContent>
</Card>
```

---

## 10. 环境变量

### 10.1 必需的环境变量
```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# App
VITE_APP_ID=app-8khk2ar42dc1
VITE_API_ENV=production
```

### 10.2 Edge Function环境变量
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 11. 部署说明

### 11.1 前端部署
1. 构建项目: `npm run build`
2. 部署到静态托管服务 (Vercel, Netlify等)
3. 配置环境变量

### 11.2 Edge Functions部署
1. 使用 `supabase_deploy_edge_function` 工具
2. 部署三个函数:
   - analyze-questionnaire
   - generate-replies
   - analyze-feedback

### 11.3 数据库迁移
1. 创建所有表结构
2. 启用RLS策略
3. 创建必要的索引

---

## 12. 测试要点

### 12.1 功能测试
- [ ] 问卷填写和提交
- [ ] 截图上传和回复生成
- [ ] 回复复制功能
- [ ] 反馈提交和画像更新
- [ ] 历史记录查看
- [ ] 画像页面显示

### 12.2 UI测试
- [ ] 移动端响应式布局
- [ ] 桌面端布局
- [ ] 动画效果
- [ ] 按钮悬停效果
- [ ] 导航栏固定
- [ ] 球体动画不被遮挡

### 12.3 错误处理测试
- [ ] 上传失败提示
- [ ] 生成失败提示
- [ ] 网络错误提示
- [ ] 错误日志记录

---

## 13. 未来优化方向

### 13.1 功能增强
- 支持多人对话场景
- 添加语音输入
- 支持更多语言
- 添加回复模板库

### 13.2 AI优化
- 更精准的画像分析
- 更自然的回复生成
- 更智能的学习策略
- 支持上下文记忆

### 13.3 用户体验
- 添加引导教程
- 优化加载速度
- 添加离线支持
- 增加个性化设置

---

## 14. 技术细节补充

### 14.1 图片上传流程
1. 用户选择图片
2. 前端验证 (格式、大小)
3. 上传到Supabase Storage
4. 获取公开URL
5. 保存到 `chat_sessions` 表

### 14.2 AI调用流程
1. 构建提示词
2. 调用Gemini API (流式响应)
3. 解析SSE流
4. 提取JSON数据
5. 返回结果

### 14.3 状态管理
- 使用 `UserProfileContext` 管理用户画像
- 使用 `useState` 管理组件状态
- 使用 `useEffect` 处理副作用

### 14.4 路由配置
```typescript
const routes = [
  { path: '/', element: <HomePage /> },
  { path: '/questionnaire', element: <QuestionnairePage /> },
  { path: '/replies/:sessionId', element: <RepliesPage /> },
  { path: '/history', element: <HistoryPage /> },
  { path: '/profile', element: <ProfilePage /> }
];
```

---

## 15. 代码规范

### 15.1 命名规范
- 组件: PascalCase (HomePage, RepliesPage)
- 函数: camelCase (generateReplies, analyzeQuestionnaire)
- 常量: UPPER_SNAKE_CASE (MAX_FILE_SIZE)
- CSS类: kebab-case (gradient-sphere, animate-float)

### 15.2 文件结构
```
src/
├── components/
│   └── ui/              # shadcn/ui组件
├── contexts/            # React Context
├── data/                # 静态数据
├── db/                  # 数据库相关
├── hooks/               # 自定义Hooks
├── lib/                 # 工具函数
├── pages/               # 页面组件
├── types/               # TypeScript类型
└── assets/              # 静态资源
```

### 15.3 TypeScript类型
```typescript
// 用户画像
interface UserProfile {
  id: string;
  personality_traits: Record<string, any>;
  language_habits: Record<string, any>;
  background_story: string;
  questionnaire_completed: boolean;
}

// 聊天会话
interface ChatSession {
  id: string;
  user_profile_id: string;
  screenshot_url: string;
  extracted_text: string;
  context: Record<string, any>;
}

// 生成的回复
interface GeneratedReply {
  text: string;
  emotion: string;
  reasoning: string;
}

// 问卷问题
interface QuestionnaireQuestion {
  id: number;
  question: string;
  type: 'select' | 'multiselect' | 'text' | 'textarea';
  options?: string[];
  placeholder?: string;
  conditionalOn?: number;
  conditionalValue?: string;
}
```

---

## 16. 关键注意事项

### 16.1 性能优化
- 图片压缩和懒加载
- 组件懒加载 (React.lazy)
- 防抖和节流
- 缓存用户画像

### 16.2 安全性
- 输入验证和清理
- XSS防护
- CSRF防护
- RLS权限控制

### 16.3 可访问性
- 语义化HTML
- ARIA标签
- 键盘导航
- 屏幕阅读器支持

### 16.4 浏览器兼容性
- 支持现代浏览器 (Chrome, Firefox, Safari, Edge)
- 移动端浏览器优化
- 渐进式增强

---

## 17. Logo资源

### 17.1 Logo文件
- 文件名: `logo.png`
- 位置: `src/assets/logo.png`
- 尺寸: 适配 28x28px (w-7 h-7)
- 格式: PNG (透明背景)
- 设计: 粉色和紫色渐变的对话气泡，包含字母"b"和爱心图案

### 17.2 Logo使用
```tsx
import logoImage from '@/assets/logo.png';

<img 
  src={logoImage} 
  alt="好好说Logo" 
  className="w-7 h-7 rounded-lg object-cover"
/>
```

---

## 18. 总结

这是一个完整的智能回复助手应用，核心功能包括：
1. **用户画像构建**: 通过问卷建立和持续学习
2. **智能回复生成**: 基于AI和用户画像生成个性化回复
3. **反馈学习**: 通过用户反馈优化画像
4. **历史记录**: 保存和查看历史对话

技术栈现代化，使用React + TypeScript + Supabase + AI，界面简洁美观，用户体验流畅，具有良好的扩展性和维护性。

---

**文档版本**: 1.0  
**最后更新**: 2026-01-06  
**维护者**: AI Assistant
