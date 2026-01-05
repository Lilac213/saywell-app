# Task: UI优化和错误处理改进

## Plan
- [x] Step 1: 更新所有页面导航栏 - 统一样式，使用Logo图片
- [x] Step 2: 修改按钮悬停效果 - 蓝色改为浅灰色
- [x] Step 3: 优化错误处理 - 友好提示，不显示技术错误
- [x] Step 4: 创建错误日志表
- [x] Step 5: 优化回复情绪标签 - 限制长度
- [x] Step 6: 优化画像更新逻辑 - 避免过快更新
- [x] Step 7: 优化问卷页面 - 欢迎语和错误提示
- [x] Step 8: 调整首页球体大小
- [x] Step 9: 运行lint检查

## Notes
- 导航栏统一: Logo + "好好说 · SayWell" + 个人画像图标 ✓
- 按钮悬停: 蓝色改为浅灰色(#E5E7EB) ✓
- 错误处理: 不显示技术错误，使用友好提示 ✓
- 错误日志表: error_logs(id, error_message, error_time, profile_id) ✓
- 回复标签: 限制为一行，max-w-[120px] truncate ✓
- 画像更新: AI提示词已优化，要求谨慎判断，避免单次反馈过度更新 ✓
- 问卷优化: 移除英文名，分行显示，友好错误提示 ✓
- 球体大小: 减小为w-32 h-32 xl:w-40 xl:h-40 ✓
- 所有页面导航栏已统一样式 ✓
- HomePage/RepliesPage/ProfilePage导航栏已更新 ✓
- 错误记录到数据库，用户看到友好提示 ✓
- analyze-feedback edge function已更新并部署 ✓
- 所有功能已实现并通过lint检查 ✓
