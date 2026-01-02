# Task: 完全重新设计UI参照UIdesign1和2

## Plan
- [x] Step 1: 分析UIdesign1和2的核心设计元素
- [x] Step 2: 重新设计HomePage - 大型渐变球体为中心
- [x] Step 3: 简化布局 - 白色背景、简洁卡片
- [x] Step 4: 重新设计RepliesPage - 对话界面风格
- [x] Step 5: 优化所有页面的视觉层次
- [x] Step 6: 运行lint检查

## Notes
- UIdesign1核心特点：
  * 大型渐变球体作为中心视觉元素(蓝粉紫渐变)
  * 纯白背景，极简布局
  * 简单白色卡片，圆角，柔和阴影
  * 底部输入栏
  * 大量留白
- UIdesign2核心特点：
  * 3D渐变球体作为主角
  * 柔和渐变背景(粉紫蓝)
  * 居中内容布局
  * 大标题+强调色文字
  * 底部行动按钮
- 设计原则：
  * 球体是主角，不是装饰
  * 极简主义，大量留白
  * 白色卡片+柔和阴影
  * 居中对齐
  * 清晰的视觉层次
- 实现细节：
  * HomePage: 白色背景，大型渐变球体(48x48/64x64)，居中布局，简洁导航(h-14)
  * 上传卡片: 白色rounded-3xl，shadow-lg，border-border/10
  * 渐变球体: gradient-sphere类，animate-float动画
  * RepliesPage: 白色背景，简洁导航，loading状态显示球体
  * 所有功能已实现并通过lint检查
