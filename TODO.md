# Task: 修复问卷保存失败bug

## Plan
- [x] Step 1: 调查问卷保存失败原因
- [x] Step 2: 修复question_order小数问题
- [x] Step 3: 修复TypeScript类型错误
- [x] Step 4: 运行lint检查

## Notes
- CRITICAL BUG: 问卷保存失败的根本原因是question_order字段类型不匹配
- 数据库schema: question_order是integer类型，不支持小数
- 问题来源: 问卷ID使用小数(2.5, 4.5, 6.5)，直接作为question_order导致数据库拒绝
- 解决方案: 使用数组索引(index)作为question_order，确保是整数
- 附加修复: RepliesPage.tsx中previousSelections数组类型声明
- 所有功能已修复并通过lint检查
