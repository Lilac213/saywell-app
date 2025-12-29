import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { questionnaireQuestions } from '@/data/questionnaire';
import { questionnaireApi, userProfileApi } from '@/db/api';
import { supabase } from '@/db/supabase';
import { Loader2, Sparkles } from 'lucide-react';

const QuestionnairePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userProfile, createProfile, updateProfile } = useUserProfile();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = questionnaireQuestions[currentStep];
  const progress = ((currentStep + 1) / questionnaireQuestions.length) * 100;

  const handleAnswerChange = (value: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: value });
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

    if (currentStep < questionnaireQuestions.length - 1) {
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

      // 保存问卷回答
      const responses = questionnaireQuestions.map((q) => ({
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

      navigate('/');
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
            欢迎使用智能回复助手
          </h1>
          <p className="text-muted-foreground">
            让我们先了解一下您，以便为您提供更个性化的回复建议
          </p>
        </div>

        <Card className="animate-scale-in shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-xl">
                问题 {currentStep + 1} / {questionnaireQuestions.length}
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
                <Input
                  placeholder={currentQuestion.placeholder}
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  className="text-base"
                />
              )}

              {currentQuestion.type === 'textarea' && (
                <Textarea
                  placeholder={currentQuestion.placeholder}
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  rows={4}
                  className="text-base resize-none"
                />
              )}

              {currentQuestion.type === 'select' && (
                <Select
                  value={answers[currentQuestion.id] || ''}
                  onValueChange={handleAnswerChange}
                >
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentQuestion.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex gap-3 pt-4">
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
                ) : currentStep === questionnaireQuestions.length - 1 ? (
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
