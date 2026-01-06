# Task: 更新Logo和UI细节优化

## Plan
- [x] Step 1: 更新所有页面使用新Logo (saywell logo.png)
- [x] Step 2: 统一所有页面标题字体样式为问卷页样式
- [x] Step 3: 减小导航栏高度和字体大小
- [x] Step 4: 移除问卷页欢迎语上方的圆点图标
- [x] Step 5: 优化首页提示信息布局为1-2行
- [x] Step 6: 运行lint检查

## Notes
- 新Logo: saywell logo.png已下载到src/assets/ ✓
- 字体样式: 统一为text-base font-bold，"SayWell"使用font-normal text-muted-foreground ✓
- 导航栏: 高度从h-14减小为h-12，Logo从w-8 h-8减小为w-7 h-7 ✓
- 主内容区域: py从py-6 xl:py-8减小为py-4 xl:py-6，球体mb从mb-6减小为mb-4 ✓
- 问卷页: 移除Sparkles圆点图标，直接显示标题 ✓
- 首页提示: 改为flex布局，文字和按钮在同一行/两行内，按钮使用shrink-0防止压缩 ✓
- 所有页面已更新: HomePage、RepliesPage、ProfilePage、QuestionnairePage ✓
- 所有功能已实现并通过lint检查 ✓
