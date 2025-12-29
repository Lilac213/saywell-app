import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { chatSessionApi } from '@/db/api';
import { supabase } from '@/db/supabase';
import { Upload, Image as ImageIcon, History, User, Sparkles } from 'lucide-react';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userProfile, loading: profileLoading } = useUserProfile();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast({
        title: '文件类型错误',
        description: '请上传图片文件',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    
    // 创建预览
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 限制最大分辨率为1080p
          const maxDimension = 1080;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                  type: 'image/webp',
                });
                resolve(compressedFile);
              } else {
                reject(new Error('压缩失败'));
              }
            },
            'image/webp',
            0.8
          );
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    if (!userProfile) {
      toast({
        title: '请先完成问卷',
        description: '需要先创建您的个性化画像',
        variant: 'destructive',
      });
      navigate('/questionnaire');
      return;
    }

    try {
      setUploading(true);

      let fileToUpload = selectedFile;

      // 如果文件大于1MB，进行压缩
      if (selectedFile.size > 1024 * 1024) {
        toast({
          title: '正在压缩图片',
          description: '文件较大，正在自动压缩...',
        });
        fileToUpload = await compressImage(selectedFile);
        toast({
          title: '压缩完成',
          description: `文件大小：${(fileToUpload.size / 1024).toFixed(2)} KB`,
        });
      }

      // 生成唯一文件名
      const timestamp = Date.now();
      const fileName = `screenshot_${timestamp}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

      // 上传到Supabase Storage
      const { data, error } = await supabase.storage
        .from('app-8khk2ar42dc1_screenshots')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(error.message);
      }

      // 获取公开URL
      const { data: urlData } = supabase.storage
        .from('app-8khk2ar42dc1_screenshots')
        .getPublicUrl(data.path);

      const uploadedUrl = urlData.publicUrl;

      // 创建聊天会话
      const session = await chatSessionApi.create(userProfile.id, uploadedUrl);
      if (!session) {
        throw new Error('创建会话失败');
      }

      // 跳转到回复建议页面
      navigate(`/replies/${session.id}`);
    } catch (error) {
      console.error('上传失败:', error);
      toast({
        title: '上传失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!userProfile?.questionnaire_completed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full animate-scale-in">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4 mx-auto">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">欢迎使用智能回复助手</CardTitle>
            <CardDescription>
              在开始使用之前，请先完成简单的问卷，帮助我们了解您的个性特征
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/questionnaire')} className="w-full" size="lg">
              开始问卷
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/30 to-background">
      {/* 顶部导航 */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">智能回复助手</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
              <History className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
              <User className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8 xl:py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 animate-fade-in">
            <h2 className="text-2xl xl:text-3xl font-bold mb-2">上传聊天截图</h2>
            <p className="text-muted-foreground">
              上传您的聊天记录截图，AI将为您生成个性化的回复建议
            </p>
          </div>

          <Card className="animate-scale-in shadow-lg">
            <CardContent className="p-6 xl:p-8">
              {!previewUrl ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-border rounded-lg p-8 xl:p-12 text-center hover:border-primary transition-colors cursor-pointer"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-accent rounded-full mb-4">
                    <Upload className="w-10 h-10 text-accent-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">点击或拖拽上传截图</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    支持 JPG、PNG、GIF、WEBP 格式，最大 1MB
                  </p>
                  <Button variant="outline">
                    <ImageIcon className="w-4 h-4 mr-2" />
                    选择图片
                  </Button>
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img
                      src={previewUrl}
                      alt="预览"
                      className="w-full h-auto max-h-96 object-contain bg-muted"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      disabled={uploading}
                      className="flex-1"
                    >
                      重新选择
                    </Button>
                    <Button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="flex-1"
                    >
                      {uploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                          上传中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          生成回复
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 功能说明 */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-8">
            <Card className="animate-fade-in">
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-3">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">快速上传</h3>
                <p className="text-sm text-muted-foreground">
                  支持拖拽上传，操作简单便捷
                </p>
              </CardContent>
            </Card>
            <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-3">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">AI智能分析</h3>
                <p className="text-sm text-muted-foreground">
                  基于您的画像生成个性化回复
                </p>
              </CardContent>
            </Card>
            <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-3">
                  <History className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">持续学习</h3>
                <p className="text-sm text-muted-foreground">
                  根据您的选择不断优化回复风格
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
