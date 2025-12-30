import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { questionnaireQuestions, updateQuestions } from '@/data/questionnaire';
import { questionnaireApi } from '@/db/api';
import { supabase } from '@/db/supabase';
import { Loader2, Sparkles } from 'lucide-react';

const QuestionnairePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userProfile, createProfile, updateProfile } = useUserProfile();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);

  // 根据是否新用户选择问题列表
  const allQuestions = isNewUser === false ? updateQuestions : questionnaireQuestions;
  
  // 过滤条件问题
  const questions = allQuestions.filter((q) => {
    if (!q.conditionalOn) return true;
    return answers[q.conditionalOn] === q.conditionalValue;
  });
  
  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  const handleAnswerChange = (value: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: value });

    // 如果是第一个问题，判断是否新用户
    if (currentQuestion.id === 0) {
      setIsNewUser(value === '是，我是新用户');
    }
  };

  const handleNext = () => {
    if (!answers[currentQuestion.id]?.trim()) {
      toast({
        title: '请回答当前问题',
        description: '请填写答案后再继续',
        variant: 'destructive',
      });
      return;
    }

    // 如果是第一个问题且选择了"否"，直接跳到补充问卷
    if (currentQuestion.id === 0 && isNewUser === false) {
      setCurrentStep(0); // 重置到补充问卷的第一题
      return;
    }

    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // 确保有用户画像
      let profile = userProfile;
      if (!profile) {
        profile = await createProfile();
        if (!profile) {
          throw new Error('创建用户画像失败');
        }
      }

      // 如果是老用户补充信息
      if (isNewUser === false) {
        const updateText = answers[100] || '';
        
        // 调用AI分析补充信息
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
          'analyze-questionnaire',
          {
            body: {
              responses: [
                {
                  question: '用户想要补充或更新的信息',
                  answer: updateText,
                },
              ],
              isUpdate: true,
              existingProfile: {
                personality_traits: profile.personality_traits,
                language_habits: profile.language_habits,
                background_story: profile.background_story,
              },
            },
          }
        );

        if (analysisError) {
          const errorMsg = await analysisError?.context?.text();
          console.error('AI分析失败:', errorMsg || analysisError?.message);
          throw new Error('AI分析失败');
        }

        // 更新用户画像（合并而非替换）
        await updateProfile({
          personality_traits: {
            ...profile.personality_traits,
            ...analysisData.personality_traits,
          },
          language_habits: {
            ...profile.language_habits,
            ...analysisData.language_habits,
          },
          background_story: analysisData.background_story || profile.background_story,
        });

        toast({
          title: '画像更新成功！',
          description: '您的个性化画像已更新',
        });

        // 延迟导航以确保状态更新
        setTimeout(() => {
          navigate('/');
        }, 500);
      } else {
        // 新用户完整问卷
        const responses = questions.map((q) => ({
          question: q.question,
          answer: answers[q.id] || '',
          question_order: q.id,
        }));

        const saved = await questionnaireApi.createBatch(profile.id, responses);
        if (!saved) {
          throw new Error('保存问卷回答失败');
        }

        // 调用AI分析问卷
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
          'analyze-questionnaire',
          {
            body: {
              responses: responses.map((r) => ({
                question: r.question,
                answer: r.answer,
              })),
              isUpdate: false,
            },
          }
        );

        if (analysisError) {
          const errorMsg = await analysisError?.context?.text();
          console.error('AI分析失败:', errorMsg || analysisError?.message);
          throw new Error('AI分析失败');
        }

        // 更新用户画像
        await updateProfile({
          personality_traits: analysisData.personality_traits || {},
          language_habits: analysisData.language_habits || {},
          background_story: analysisData.background_story || '',
          questionnaire_completed: true,
        });

        toast({
          title: '问卷完成！',
          description: '您的个性化画像已创建，现在可以开始使用智能回复助手了',
        });

        // 延迟导航以确保状态更新
        setTimeout(() => {
          navigate('/');
        }, 500);
      }
    } catch (error) {
      console.error('提交问卷失败:', error);
      toast({
        title: '提交失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/30 to-background p-4 xl:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl xl:text-4xl font-bold text-foreground mb-2">
            {isNewUser === false ? '更新您的画像' : '欢迎使用智能回复助手'}
          </h1>
          <p className="text-muted-foreground">
            {isNewUser === false
              ? '告诉我们您想补充或更新的信息'
              : '让我们先了解一下您，以便为您提供更个性化的回复建议'}
          </p>
        </div>

        <Card className="animate-scale-in shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-xl">
                问题 {currentStep + 1} / {questions.length}
              </CardTitle>
              <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <CardDescription className="mt-4 text-base">
              {currentQuestion.question}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              {currentQuestion.type === 'text' && (
                <input
                  type="text"
                  placeholder={currentQuestion.placeholder}
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              )}

              {currentQuestion.type === 'textarea' && (
                <textarea
                  placeholder={currentQuestion.placeholder}
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  rows={4}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
              )}

              {currentQuestion.type === 'select' && (
                <div className="space-y-2">
                  {currentQuestion.options?.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleAnswerChange(option)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                        answers[currentQuestion.id] === option
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:border-primary/50 hover:bg-accent'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                disabled={isSubmitting}
                className="flex-1"
              >
                返回首页
              </Button>
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0 || isSubmitting}
                className="flex-1"
              >
                上一题
              </Button>
              <Button
                onClick={handleNext}
                disabled={isSubmitting || !answers[currentQuestion.id]?.trim()}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : currentStep === questions.length - 1 ? (
                  '完成'
                ) : (
                  '下一题'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          您的回答将用于创建个性化的回复风格，我们会保护您的隐私
        </div>
      </div>
    </div>
  );
};

export default QuestionnairePage;
