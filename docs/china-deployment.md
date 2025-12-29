# 关于中国境内访问的说明

## 当前状况

本应用使用的后端服务：
- **Supabase数据库**: 可以在中国境内正常访问
- **Gemini AI API**: 通过 `api-integrations.appmedo.com` 提供，可能在中国境内访问受限

## 访问问题

如果您在中国境内使用本应用时遇到"分析较慢"或"加载不出来"的问题，这是因为AI分析服务的网络连接问题。

## 解决方案

### 短期方案
1. 使用VPN或代理服务访问
2. 使用"跳过问卷"功能快速开始，减少AI调用次数
3. 耐心等待，AI分析可能需要30-60秒

### 长期方案（需要开发者实施）

如果需要在中国境内稳定使用，建议替换为中国境内可访问的AI服务：

#### 推荐的国内AI服务商：

1. **阿里云通义千问 (Qwen)**
   - 官网: https://dashscope.aliyun.com/
   - 优点: 性能强大，响应快速，中文理解优秀
   - 需要: 阿里云账号和API密钥

2. **百度文心一言 (ERNIE)**
   - 官网: https://cloud.baidu.com/product/wenxinworkshop
   - 优点: 中文处理能力强，价格合理
   - 需要: 百度智能云账号和API密钥

3. **腾讯混元 (Hunyuan)**
   - 官网: https://cloud.tencent.com/product/hunyuan
   - 优点: 腾讯云生态集成好
   - 需要: 腾讯云账号和API密钥

4. **智谱AI (ChatGLM)**
   - 官网: https://open.bigmodel.cn/
   - 优点: 开源友好，API简单
   - 需要: 智谱AI账号和API密钥

#### 如何替换AI服务

需要修改以下Edge Functions：
- `/supabase/functions/analyze-questionnaire/index.ts`
- `/supabase/functions/generate-replies/index.ts`

将Gemini API调用替换为国内AI服务的API调用。

## 当前应用的优化

我们已经做了以下优化来改善用户体验：

1. **更好的错误提示**: 当AI服务不可用时，会显示友好的错误信息
2. **快速开始选项**: 可以跳过问卷，使用默认画像快速体验
3. **本地数据缓存**: 用户画像和历史记录存储在本地，不受网络影响
4. **超时处理**: 设置合理的超时时间，避免长时间等待

## 技术支持

如果您需要帮助替换AI服务或有其他技术问题，请联系开发团队。
