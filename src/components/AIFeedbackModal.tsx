import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/db/supabase";
import { Loader2, Paperclip } from "lucide-react";
import type { UserProfile } from "@/types/types";

interface AIFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiResultId: string;
  screenshotUrl?: string; // Pre-fill with current screenshot if available
  userProfile?: UserProfile | null;
}

export const AIFeedbackModal: React.FC<AIFeedbackModalProps> = ({
  isOpen,
  onClose,
  aiResultId,
  screenshotUrl,
  userProfile
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackType, setFeedbackType] = useState<string>('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const getPlaceholder = () => {
    if (feedbackType === 'role_confusion') {
      return "请务必提供正确的对话文本，格式如下：\n对方：[对方说的话]\n用户：[我说的话]\n\n（这将帮助AI重新学习您的语言风格）";
    }
    return "请描述AI的错误点及正确结果 (不少于10字)";
  };

  const handleSubmit = async () => {
    if (!feedbackType) {
      toast({
        title: "请选择反馈类型",
        variant: "destructive",
      });
      return;
    }
    if (content.trim().length < 10) {
      toast({
        title: "描述太短",
        description: "请至少输入10个字的问题描述",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let attachmentUrl = screenshotUrl;

      // Handle file upload if a new file is selected
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `feedback_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { data, error: uploadError } = await supabase.storage
          .from('app-8khk2ar42dc1_screenshots') // Reuse existing bucket or create new
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('app-8khk2ar42dc1_screenshots')
          .getPublicUrl(data.path);
        
        attachmentUrl = urlData.publicUrl;
      }

      // Insert feedback
      const { data: feedbackData, error: insertError } = await supabase
        .from('ai_feedbacks')
        .insert({
          user_id: userProfile?.user_id || userProfile?.id, // 确保关联到用户
          ai_result_id: aiResultId,
          feedback_type: feedbackType,
          content: content,
          attach_file: attachmentUrl,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: "反馈已记录",
        description: "正在根据您的反馈优化模型...",
      });

      // Trigger AI optimization immediately
      // 只要有 userProfile 就尝试进行 AI 优化，即使 feedbackData 因为 RLS 问题没返回
      if (userProfile) {
        console.log("Starting AI analysis...", { 
          hasProfile: true, 
          hasFeedbackData: !!feedbackData,
          feedbackId: feedbackData?.id 
        });

        const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-feedback', {
          body: {
            feedbackText: content,
            userProfileId: userProfile.id,
            existingProfile: {
              personality_traits: userProfile.personality_traits,
              language_habits: userProfile.language_habits,
              background_story: userProfile.background_story,
            },
            feedbackId: feedbackData?.id, // Optional
            feedbackType: feedbackType
          }
        });

        // 检查 HTTP 错误或业务逻辑错误
        if (analysisError || (analysisData && analysisData.error)) {
          console.error('AI optimization failed:', analysisError || analysisData?.error);
          
          // 尝试解析错误信息
          let errorMsg = "请稍后重试";
          if (analysisData && analysisData.error) {
            errorMsg = analysisData.error;
          } else {
            try {
               // 如果是 FunctionsHttpError，可能包含详细信息
               if (analysisError instanceof Error) {
                 errorMsg = analysisError.message;
               }
               // 尝试读取 response body 如果有
               if ('context' in analysisError && (analysisError as any).context?.json) {
                  const body = await (analysisError as any).context.json();
                  if (body.error) errorMsg = body.error;
               }
            } catch (e) {
               console.error("Error parsing analysis error", e);
            }
          }

          toast({
            title: "自动优化失败",
            description: `原因: ${errorMsg}`,
            variant: "destructive"
          });
        } else {
          console.log("AI analysis successful:", analysisData);
          
          // 只有当有 feedbackData 时才更新状态
          if (feedbackData?.id) {
            try {
               const { error: updateStatusError } = await supabase
                .from('ai_feedbacks')
                .update({ 
                  handle_status: 'tuned',
                  handle_note: 'AI已自动根据反馈优化画像 (Client-side verified)'
                })
                .eq('id', feedbackData.id);
               
               if (updateStatusError) console.error("Client-side status update failed", updateStatusError);
            } catch (e) {
              console.error("Client-side status update exception", e);
            }
          }

          toast({
            title: "优化完成",
            description: "您的画像已更新，下次回复将更符合您的期望",
          });
        }
      } else {
         console.warn("Skipping AI analysis: userProfile missing", { userProfile: !!userProfile });
         toast({
          title: "反馈提交成功",
          description: "已同步至AI库 (未触发优化: 缺少用户画像)",
          variant: "destructive" // 使用红色提示引起注意
        });
      }

      onClose();
      // Reset form
      setFeedbackType('');
      setContent('');
      setFile(null);

    } catch (error: any) {
      console.error('Feedback submission error:', error);
      toast({
        title: "提交失败",
        description: error.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>🔧 AI结果反馈 (测试专用)</DialogTitle>
          <DialogDescription>
            请帮助我们优化模型，您的反馈至关重要。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="feedback-type">反馈类型 <span className="text-red-500">*</span></Label>
            <Select onValueChange={setFeedbackType} value={feedbackType}>
              <SelectTrigger id="feedback-type">
                <SelectValue placeholder="请选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role_confusion">角色混淆</SelectItem>
                <SelectItem value="analysis_error">分析错误</SelectItem>
                <SelectItem value="style_mismatch">回复风格不符</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="content">具体问题描述 <span className="text-red-500">*</span></Label>
            <Textarea
              id="content"
              placeholder={getPlaceholder()}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div className="grid gap-2">
            <Label>关联AI结果ID</Label>
            <Input disabled value={aiResultId} className="bg-muted font-mono text-xs" />
          </div>
          <div className="grid gap-2">
            <Label>附件 (可选)</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="file" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload"
                accept="image/*"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Paperclip className="w-4 h-4 mr-2" />
                {file ? file.name : (screenshotUrl ? "使用当前截图 (点击更换)" : "上传截图")}
              </Button>
            </div>
            {screenshotUrl && !file && (
              <p className="text-xs text-muted-foreground">默认关联当前对话截图</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            提交反馈
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
