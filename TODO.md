# Task: 修复反馈功能并实现UI设计规范

## Plan
- [x] Step 1: 修复GEMINI_API_KEY配置问题 - 使用gemini-2.5-flash模型
- [x] Step 2: 实现对话框设计规范 - 24px圆角胶囊形、粉色渐变
- [x] Step 3: 实现行距设置规范 - 1.6倍行距、标题间距2.5rem
- [x] Step 4: 实现字体选用规范 - 思源黑体、0.5px字间距、20px标题14px正文
- [x] Step 5: 实现Logo使用规范 - 渐变Logo、双行文字布局
- [x] Step 6: 应用色彩色值参考表 - #6B7FFF蓝、#E879F9紫、#F9C5E9粉
- [x] Step 7: 运行lint检查

## Notes
- CRITICAL: 反馈提交已修复 - 使用gemini-2.5-flash模型，匹配analyze-questionnaire的API调用方式
- Edge Function更新：使用role: 'user'格式，移除generationConfig，使用jsonMatch提取JSON
- 对话框圆角：1.5rem(24px)胶囊形，渐变#F9C5E9到#F0B8E0，边框#F0B8E0
- 行距：body 1.6倍、标题1.3倍、模块间2rem、标题下2.5rem
- 字体：Source Han Sans CN Bold 20px标题、Regular 14px正文、0.5px字间距
- Logo渐变：#6B7FFF到#E879F9，40px尺寸，双行文字布局
- 主色：#4A90E2(221° 83% 53%)蓝、#9013FE(277° 99% 54%)紫、#F9C5E9(320° 71% 88%)粉
- 按钮：#1E1E2E深色背景、#FFFFFF白色文字、12px圆角
- 背景：白色(100%)提升可读性，卡片白色，边框90%灰
- 所有功能已实现并通过lint检查
