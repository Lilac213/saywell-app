import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { chatSessionApi, replySelectionApi } from '@/db/api';
import { supabase } from '@/db/supabase';
import { ArrowLeft, Copy, Check, Sparkles, Loader2, User, ImageIcon } from 'lucide-react';
import type { ChatSession, GeneratedReply } from '@/types/types';
import logoImage from '@/assets/logo.png';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AIFeedbackModal } from '@/components/AIFeedbackModal';
import { motion, AnimatePresence } from 'framer-motion';

const RepliesPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userProfile, refreshProfile } = useUserProfile();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [replies, setReplies] = useState<GeneratedReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransition, setShowTransition] = useState(false); // 控制过渡动画状态
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null); // 用于显示的图片URL，null表示不显示或加载失败
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [intentAnalysis, setIntentAnalysis] = useState<string>('');
  const [emotionAnalysis, setEmotionAnalysis] = useState<string>('');
  const [relationship, setRelationship] = useState<string>('');
  const [chatRemark, setChatRemark] = useState<string>('');
  
  // AI Feedback Logic
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackSystemEnabled, setFeedbackSystemEnabled] = useState(true);

  useEffect(() => {
    if (sessionId && userProfile) {
      loadSessionAndGenerateReplies();
    }
    fetchConfig();
  }, [sessionId, userProfile]);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'ai_feedback_enabled')
      .single();
    
    if (data) {
      setFeedbackSystemEnabled(data.value);
    }
  };

  const handleLogoClick = () => {
    // Check config first
    if (!feedbackSystemEnabled) return;

    // Only allow testers to trigger this
    if (userProfile?.is_tester) {
      const newCount = logoClickCount + 1;
      setLogoClickCount(newCount);
      if (newCount >= 5) {
        setIsFeedbackModalOpen(true);
        setLogoClickCount(0);
      }
    }
  };

  const loadSessionAndGenerateReplies = async () => {
    if (!sessionId || !userProfile) return;

    const timers = {
      total: `TotalReplyGeneration:${sessionId}`,
      fetchSession: `FetchSessionData:${sessionId}`,
      fetchHistory: `FetchHistory:${sessionId}`,
      ai: `AIGeneration:${sessionId}`,
    };
    let totalTimerStarted = false;

    try {
      console.time(timers.total); // ⏱️ 开始计时：总流程
      totalTimerStarted = true;
      setLoading(true);

      // 加载会话信息
      console.time(timers.fetchSession); // ⏱️ 开始计时：获取会话
      const sessionData = await chatSessionApi.getById(sessionId);
      if (!sessionData) {
        throw new Error('会话不存在');
      }
      setSession(sessionData);
      // 初始化显示URL
      if (sessionData.screenshot_url) {
        setDisplayImageUrl(sessionData.screenshot_url);
      }
      console.timeEnd(timers.fetchSession); // ⏱️ 结束计时：获取会话

      // 将图片URL转换为base64的步骤已移除，直接使用URL
      // console.time('ImageProcessing');
      // ...
      // console.timeEnd('ImageProcessing');

      // 获取历史选择记录（用于学习）
      console.time(timers.fetchHistory); // ⏱️ 开始计时：获取历史
      const allSessions = await chatSessionApi.getByUserProfile(userProfile.id, 10);
      
      // 并行获取历史记录，提高速度
      const previousSelectionsPromises = allSessions
        .filter(s => s.id !== sessionId)
        .map(async (s) => {
          const selection = await replySelectionApi.getByChatSession(s.id);
          if (selection) {
            return {
              generated_replies: selection.generated_replies,
              selected_reply: selection.selected_reply,
            };
          }
          return null;
        });

      const previousSelectionsResults = await Promise.all(previousSelectionsPromises);
      const previousSelections = previousSelectionsResults.filter((item): item is { generated_replies: string[]; selected_reply: string } => item !== null);
      
      console.timeEnd(timers.fetchHistory); // ⏱️ 结束计时：获取历史

      // 调用AI生成回复
      console.time(timers.ai); // ⏱️ 开始计时：AI生成
      const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-replies', {
        body: {
          screenshotUrl: sessionData.screenshot_url, // 直接传递URL，不再传递Base64
          userProfile: {
            personality_traits: userProfile.personality_traits,
            language_habits: userProfile.language_habits,
            background_story: userProfile.background_story,
          },
          previousSelections,
        },
      });
      console.timeEnd(timers.ai); // ⏱️ 结束计时：AI生成

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

      if (!aiData) {
        throw new Error('AI返回数据为空');
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

      setReplies(Array.isArray(aiData.replies) ? aiData.replies : []);
      
      // 数据准备就绪，触发过渡动画
      setShowTransition(true);
      // 延迟关闭loading，让过渡动画展示完
      setTimeout(() => {
        setLoading(false);
        setShowTransition(false);
      }, 2000); // 给足够的时间展示过渡文案 (300-500ms fade out + 1500ms display)

    } catch (error) {
      console.error('加载失败:', error);
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
      navigate('/');
      setLoading(false);
    } finally {
      if (totalTimerStarted) {
        console.timeEnd(timers.total); // ⏱️ 结束计时：总流程
      }
      // setLoading(false) is handled in the success path after transition
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
        console.time('FeedbackAnalysis'); // ⏱️ 开始计时：反馈分析
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-feedback', {
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
        console.timeEnd('FeedbackAnalysis'); // ⏱️ 结束计时：反馈分析

        if (analysisError || (analysisData && analysisData.error)) {
          // 尝试解析错误信息
          let errorMsg = "请稍后重试";
          if (analysisData && analysisData.error) {
             errorMsg = analysisData.error;
          } else {
             try {
                if (analysisError instanceof Error) errorMsg = analysisError.message;
                const contextError = await analysisError?.context?.text?.();
                if (contextError) errorMsg = contextError;
             } catch (e) { console.error(e); }
          }
          
          console.error('分析反馈失败:', errorMsg);
          
          toast({
            title: '反馈已保存',
            description: `但画像更新失败：${errorMsg}`,
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

  const handleImageError = () => {
    console.error('图片加载失败');
    // 防止重复触发
    if (displayImageUrl === null) return;
    
    toast({
      title: '图片显示失败',
      description: '但这不影响AI生成回复',
      variant: 'destructive',
    });
    // 设置为 null 表示加载失败，不再尝试显示
    setDisplayImageUrl(null); 
  };

  if (loading) {
    if (showTransition) {
      return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <img 
                src={logoImage} 
                alt="好好说" 
                className="w-8 h-8 object-contain"
              />
            </div>
            <h2 className="text-xl font-medium text-foreground">
              我帮你整理了几种不同风格的回应方式
            </h2>
            <p className="text-muted-foreground">
              你可以选一个最符合当下感受的
            </p>
          </motion.div>
        </div>
      );
    }
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 简洁顶部导航 */}
      <header className="border-b border-border/10 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div onClick={handleLogoClick} className="cursor-pointer active:opacity-70 transition-opacity">
              <img 
                src={logoImage} 
                alt="好好说Logo" 
                className="w-7 h-7 rounded-lg object-cover"
              />
            </div>
            <h1 className="text-base font-bold">好好说 · <span className="font-normal text-muted-foreground">SayWell</span></h1>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/profile')}>
            <User className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-6 py-6 xl:py-8">
        <div className="max-w-2xl mx-auto">
          {/* 截图预览 */}
          {session && (
            <Card className="mb-6 animate-fade-in">
              <CardHeader>
                <CardTitle className="text-lg">聊天截图</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg overflow-hidden border border-border flex justify-center bg-muted min-h-[100px] items-center">
                  {displayImageUrl ? (
                    <img
                      src={displayImageUrl}
                      alt="聊天截图"
                      onError={handleImageError}
                      className="w-full h-auto max-h-64 object-contain"
                    />
                  ) : (
                    <div className="text-muted-foreground text-sm p-4 flex flex-col items-center gap-2">
                      <ImageIcon className="w-8 h-8 opacity-50" />
                      <span>{displayImageUrl === null ? '图片加载失败' : '暂无图片'}</span>
                    </div>
                  )}
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

            {replies && replies.length > 0 ? (
              replies.map((reply, index) => (
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
                        <Badge variant={index === 3 ? 'outline' : 'secondary'} className="max-w-[120px] truncate">
                          {reply.tone}
                        </Badge>
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
            ))) : (
              <div className="text-center py-10 text-muted-foreground">
                <p>暂时无法生成回复，请稍后重试。</p>
              </div>
            )}

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

      {/* AI Feedback Modal for Testers */}
      <AIFeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          aiResultId={sessionId || ''}
          screenshotUrl={displayImageUrl || undefined}
          userProfile={userProfile}
        />
    </div>
  );
};

export default RepliesPage;
