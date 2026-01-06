# Task: 修复Logo图片路径问题

## Plan
- [x] Step 1: 将logo.jpg从public文件夹复制到src/assets文件夹
- [x] Step 2: 更新所有页面导入logo图片
- [x] Step 3: 运行lint检查

## Notes
- Logo路径问题: 原来使用/logo.jpg相对路径，在生产环境可能无法加载
- 解决方案: 将logo.jpg移动到src/assets/并使用import导入
- 更新页面: HomePage、RepliesPage、ProfilePage、QuestionnairePage
- 所有页面现在使用import logoImage from '@/assets/logo.jpg'
- Vite会自动处理资源路径，确保在生产环境正确加载
- 所有功能已实现并通过lint检查 ✓
