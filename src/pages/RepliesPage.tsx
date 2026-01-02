import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { chatSessionApi, replySelectionApi } from '@/db/api';
import { supabase } from '@/db/supabase';
import { ArrowLeft, Copy, Check, Sparkles, Loader2 } from 'lucide-react';
import type { ChatSession, GeneratedReply } from '@/types/types';

const RepliesPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userProfile, refreshProfile } = useUserProfile();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [replies, setReplies] = useState<GeneratedReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [intentAnalysis, setIntentAnalysis] = useState<string>('');
  const [emotionAnalysis, setEmotionAnalysis] = useState<string>('');
  const [relationship, setRelationship] = useState<string>('');
  const [chatRemark, setChatRemark] = useState<string>('');

  useEffect(() => {
    if (sessionId) {
      loadSessionAndGenerateReplies();
    }
  }, [sessionId]);

  const loadSessionAndGenerateReplies = async () => {
    if (!sessionId || !userProfile) return;

    try {
      setLoading(true);

      // 加载会话信息
      const sessionData = await chatSessionApi.getById(sessionId);
      if (!sessionData) {
        throw new Error('会话不存在');
      }
      setSession(sessionData);

      // 将图片URL转换为base64
      const response = await fetch(sessionData.screenshot_url);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      // 获取历史选择记录（用于学习）
      const allSessions = await chatSessionApi.getByUserProfile(userProfile.id, 10);
      const previousSelections: Array<{ generated_replies: string[]; selected_reply: string }> = [];
      for (const s of allSessions) {
        if (s.id === sessionId) continue;
        const selection = await replySelectionApi.getByChatSession(s.id);
        if (selection) {
          previousSelections.push({
            generated_replies: selection.generated_replies,
            selected_reply: selection.selected_reply,
          });
        }
      }

      // 调用AI生成回复
      const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-replies', {
        body: {
          screenshotBase64: base64,
          userProfile: {
            personality_traits: userProfile.personality_traits,
            language_habits: userProfile.language_habits,
            background_story: userProfile.background_story,
          },
          previousSelections,
        },
      });

      if (aiError) {
        const errorMsg = await aiError?.context?.text();
        console.error('AI生成回复失败:', errorMsg || aiError?.message);
        
        // 提供更友好的错误提示
        toast({
          title: 'AI分析失败',
          description: '网络连接问题或服务暂时不可用，请稍后重试',
          variant: 'destructive',
        });
        
        throw new Error('AI生成回复失败');
      }

      // 更新会话的提取文本和用户风格观察
      if (aiData.extracted_text || aiData.user_style_observation || aiData.intent_analysis) {
        await chatSessionApi.update(sessionId, {
          extracted_text: aiData.extracted_text || null,
          context: { 
            analysis: aiData.context_analysis,
            user_style_observation: aiData.user_style_observation,
            intent_analysis: aiData.intent_analysis,
            emotion_analysis: aiData.emotion_analysis,
            relationship: aiData.relationship,
            chat_remark: aiData.chat_remark,
          },
        });
        setIntentAnalysis(aiData.intent_analysis || '');
        setEmotionAnalysis(aiData.emotion_analysis || '');
        setRelationship(aiData.relationship || '');
        setChatRemark(aiData.chat_remark || '');
      }

      setReplies(aiData.replies || []);
    } catch (error) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast({
        title: '已复制',
        description: '回复内容已复制到剪贴板',
      });
    } catch (error) {
      toast({
        title: '复制失败',
        description: '请手动复制',
        variant: 'destructive',
      });
    }
  };

  const handleSelect = async (reply: GeneratedReply, index: number) => {
    if (!sessionId) return;

    setSelectedIndex(index);

    // 如果选择的是第4个反馈选项，显示文本框收集反馈
    if (index === 3) {
      setShowFeedbackInput(true);
      return;
    }

    // 保存选择记录
    await replySelectionApi.create(
      sessionId,
      replies.map((r) => r.text),
      reply.text,
      index
    );

    toast({
      title: '已记录您的选择',
      description: '我们会根据您的选择持续优化回复风格',
    });

    // 延迟返回首页
    setTimeout(() => {
      navigate('/');
    }, 1500);
  };

  const handleSubmitFeedback = async () => {
    if (!sessionId || !feedbackText.trim()) {
      toast({
        title: '请输入反馈内容',
        variant: 'destructive',
      });
      return;
    }

    setSubmittingFeedback(true);

    try {
      // 立即显示提交成功提示
      toast({
        title: '正在处理您的反馈...',
        description: '请稍候，我们正在分析并更新您的画像',
      });

      // 保存反馈记录
      await replySelectionApi.create(
        sessionId,
        replies.map((r) => r.text),
        `用户反馈：${feedbackText}`,
        3
      );

      // 调用Edge Function分析反馈并更新画像
      if (userProfile) {
        const { data, error } = await supabase.functions.invoke('analyze-feedback', {
          body: {
            feedbackText,
            userProfileId: userProfile.id,
            existingProfile: {
              personality_traits: userProfile.personality_traits,
              language_habits: userProfile.language_habits,
              background_story: userProfile.background_story,
            },
          },
        });

        if (error) {
          const errorMsg = await error?.context?.text?.();
          console.error('分析反馈失败:', errorMsg || error?.message || error);
          toast({
            title: '反馈已保存',
            description: `但画像更新失败：${errorMsg || error?.message || '请稍后重试'}`,
            variant: 'destructive',
          });
        } else if (data?.error) {
          console.error('Edge Function返回错误:', data.error);
          toast({
            title: '反馈已保存',
            description: `但画像更新失败：${data.error}`,
            variant: 'destructive',
          });
        } else {
          // 刷新用户画像
          await refreshProfile();
          toast({
            title: '反馈提交成功！',
            description: '您的画像已根据反馈更新',
          });
        }
      } else {
        toast({
          title: '反馈已保存',
          description: '感谢您的反馈',
        });
      }

      // 延迟返回首页
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('提交反馈失败:', error);
      toast({
        title: '提交失败',
        description: '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleCancelFeedback = () => {
    setShowFeedbackInput(false);
    setSelectedIndex(null);
    setFeedbackText('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent/30 to-background">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-full mb-4">
            <Sparkles className="w-10 h-10 text-primary-foreground animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-2">AI正在分析中...</h2>
          <p className="text-muted-foreground">正在为您生成个性化回复建议</p>
          <div className="mt-6">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/30 to-background">
      {/* 顶部导航 */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold ml-2">回复建议</h1>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-6 xl:py-8">
        <div className="max-w-4xl mx-auto">
          {/* 截图预览 */}
          {session && (
            <Card className="mb-6 animate-fade-in">
              <CardHeader>
                <CardTitle className="text-lg">聊天截图</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg overflow-hidden border border-border">
                  <img
                    src={session.screenshot_url}
                    alt="聊天截图"
                    className="w-full h-auto max-h-64 object-contain bg-muted"
                  />
                </div>
                {session.extracted_text && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">识别的文本：</p>
                    <p className="text-sm whitespace-pre-wrap">{session.extracted_text}</p>
                  </div>
                )}
                {session.context?.user_style_observation && (
                  <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm text-primary font-medium mb-1">📝 从截图中观察到的您的语言风格：</p>
                    <p className="text-sm text-foreground">{session.context.user_style_observation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI意图分析 */}
          {(intentAnalysis || emotionAnalysis || relationship) && (
            <Card className="mb-6 animate-fade-in bg-gradient-to-br from-primary/5 to-accent/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  AI分析
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {chatRemark && relationship && (
                  <div className="p-3 bg-background rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground mb-1">对方信息</p>
                    <p className="text-base">
                      <span className="font-medium">{chatRemark}</span>
                      {' · '}
                      <span className="text-muted-foreground">{relationship}</span>
                    </p>
                  </div>
                )}
                {emotionAnalysis && (
                  <div className="p-3 bg-background rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground mb-1">对方情绪</p>
                    <p className="text-base">{emotionAnalysis}</p>
                  </div>
                )}
                {intentAnalysis && (
                  <div className="p-3 bg-background rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground mb-1">对方意图</p>
                    <p className="text-base">{intentAnalysis}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 回复建议列表 */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              为您推荐的回复
            </h2>

            {replies.map((reply, index) => (
              <Card
                key={index}
                className={`animate-slide-up transition-all hover:shadow-lg ${
                  selectedIndex === index ? 'ring-2 ring-primary' : ''
                } ${index === 3 ? 'border-dashed' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-base">
                          {index === 3 ? '💭 反馈选项' : `回复选项 ${index + 1}`}
                        </CardTitle>
                        <Badge variant={index === 3 ? 'outline' : 'secondary'}>{reply.tone}</Badge>
                      </div>
                      <CardDescription className="text-sm">{reply.reasoning}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`p-4 rounded-lg ${index === 3 ? 'bg-muted/50 border border-dashed border-border' : 'bg-accent/50'}`}>
                    <p className="text-base leading-relaxed">{reply.text}</p>
                  </div>
                  <div className="flex gap-2">
                    {index !== 3 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(reply.text, index)}
                        className="flex-1"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            复制
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleSelect(reply, index)}
                      disabled={selectedIndex !== null}
                      className="flex-1"
                      variant={index === 3 ? 'outline' : 'default'}
                    >
                      {selectedIndex === index ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          已选择
                        </>
                      ) : index === 3 ? (
                        '提供反馈'
                      ) : (
                        '选择此回复'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* 反馈输入区域 */}
            {showFeedbackInput && (
              <Card className="animate-scale-in border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg">请输入您的反馈</CardTitle>
                  <CardDescription>
                    告诉我们您期望的回复内容或对以上回复的建议
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="例如：我希望回复更简洁一些，或者我想说..."
                    rows={4}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleCancelFeedback}
                      className="flex-1"
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleSubmitFeedback}
                      disabled={!feedbackText.trim() || submittingFeedback}
                      className="flex-1"
                    >
                      {submittingFeedback ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          提交中...
                        </>
                      ) : (
                        '提交反馈'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            选择一个回复后，我们会记录您的偏好以优化未来的建议
          </div>
        </div>
      </main>
    </div>
  );
};

export default RepliesPage;
