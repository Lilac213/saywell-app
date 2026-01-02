import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { chatSessionApi } from '@/db/api';
import { supabase } from '@/db/supabase';
import { Upload, Image as ImageIcon, User, Sparkles, TrendingUp, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userProfile, loading: profileLoading, createProfile, updateProfile } = useUserProfile();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // 自动创建默认画像（如果不存在）
  useEffect(() => {
    const initProfile = async () => {
      if (!profileLoading && !userProfile) {
        const profile = await createProfile();
        if (profile) {
          await updateProfile({
            personality_traits: { 
              性别: '未设置',
              星座: '未设置',
              年龄段: '未设置',
              性格特点: '随和自然'
            },
            language_habits: { 
              发消息习惯: '灵活多变',
              表达方式: '简洁明了'
            },
            background_story: '一个喜欢使用智能工具的用户',
            questionnaire_completed: true,
          });
        }
      }
    };

    initProfile();
  }, [profileLoading, userProfile, createProfile, updateProfile]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="border-b border-border/20 bg-card/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.jpg" 
              alt="好好说Logo" 
              className="w-10 h-10 rounded-2xl shadow-lg object-cover"
            />
            <div className="flex flex-col">
              <h1 className="text-base font-bold leading-tight">好好说 · SayWell</h1>
              <p className="text-xs text-muted-foreground leading-tight">帮助你好好说话的AI助手</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10" onClick={() => navigate('/profile')}>
            <User className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-6 py-12 xl:py-16 relative">
        {/* 装饰性渐变球体 */}
        <div className="absolute top-20 right-10 w-64 h-64 gradient-sphere animate-float opacity-20 pointer-events-none hidden xl:block" />
        <div className="absolute bottom-20 left-10 w-48 h-48 gradient-sphere animate-float opacity-15 pointer-events-none hidden xl:block" style={{ animationDelay: '2s' }} />
        
        <div className="max-w-2xl mx-auto relative z-10">
          {/* 提示信息 - 胶囊形对话框设计 */}
          <div className="mb-8 spacing-module">
            <div className="dialog-capsule border border-[#F0B8E0]">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-[#333333] leading-relaxed">
                  前往
                  <button 
                    className="mx-1 text-primary font-medium hover:underline"
                    onClick={() => navigate('/profile')}
                  >
                    我的画像
                  </button>
                  填写问卷，完善您的人设和说话习惯，获得更符合您风格的回复建议
                </p>
              </div>
            </div>
          </div>

          <div className="text-center spacing-title">
            <h2 className="text-xl font-bold mb-8">上传聊天截图</h2>
            <p className="text-sm text-[#999999] leading-relaxed">
              上传聊天记录截图，AI为您生成个性化回复建议
            </p>
          </div>

          <Card className="animate-scale-in glass-card shadow-xl border-0">
            <CardContent className="p-8 xl:p-10">
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
                      className="flex-1 button-dark"
                    >
                      {uploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
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

          {/* 功能说明 - 极简设计 */}
          <div className="mt-12 text-center text-xs text-muted-foreground/60">
            <div className="inline-flex items-center gap-6">
              <span className="flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                快速上传
              </span>
              <span className="w-px h-3 bg-border/50" />
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI分析
              </span>
              <span className="w-px h-3 bg-border/50" />
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                持续学习
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
