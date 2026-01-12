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

interface AIFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiResultId: string;
  screenshotUrl?: string; // Pre-fill with current screenshot if available
}

export const AIFeedbackModal: React.FC<AIFeedbackModalProps> = ({
  isOpen,
  onClose,
  aiResultId,
  screenshotUrl
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackType, setFeedbackType] = useState<string>('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

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
      const { error: insertError } = await supabase
        .from('ai_feedbacks')
        .insert({
          ai_result_id: aiResultId,
          feedback_type: feedbackType,
          content: content,
          attach_file: attachmentUrl,
        });

      if (insertError) throw insertError;

      toast({
        title: "反馈提交成功",
        description: "已同步至AI训练库",
      });
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
              placeholder="请描述AI的错误点及正确结果 (不少于10字)"
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
