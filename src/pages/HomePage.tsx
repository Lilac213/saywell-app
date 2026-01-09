import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { chatSessionApi } from '@/db/api';
import { supabase } from '@/db/supabase';
import { Upload, Image as ImageIcon, User, Sparkles, Info, X, Loader2 } from 'lucide-react';
import logoImage from '@/assets/logo.png';

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
    console.time('ImageCompression'); // ⏱️ 开始计时：压缩
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 限制最大分辨率为 512 (降低分辨率以显著提升AI处理速度，同时保持文字可读性)
          const maxDimension = 512;
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
                console.timeEnd('ImageCompression'); // ⏱️ 结束计时：压缩
                resolve(compressedFile);
              } else {
                reject(new Error('压缩失败'));
              }
            },
            'image/webp',
            0.6 // 降低质量到 0.6，进一步减小体积
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
      console.time('TotalUploadProcess'); // ⏱️ 开始计时：总流程
      setUploading(true);

      let fileToUpload = selectedFile;

      // 如果文件大于200KB，进行压缩 (降低阈值以确保更快的上传和分析)
      if (selectedFile.size > 200 * 1024) {
        toast({
          title: '正在压缩图片',
          description: '正在优化图片大小以提高分析速度...',
        });
        fileToUpload = await compressImage(selectedFile);
        toast({
          title: '压缩完成',
          description: `优化后大小：${(fileToUpload.size / 1024).toFixed(2)} KB`,
        });
      }

      // 生成唯一文件名
      const timestamp = Date.now();
      const fileName = `screenshot_${timestamp}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

      // 上传到Supabase Storage
      console.time('SupabaseStorageUpload'); // ⏱️ 开始计时：上传
      const { data, error } = await supabase.storage
        .from('app-8khk2ar42dc1_screenshots')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
        });
      console.timeEnd('SupabaseStorageUpload'); // ⏱️ 结束计时：上传

      if (error) {
        throw new Error(error.message);
      }

      // 获取公开URL
      const { data: urlData } = supabase.storage
        .from('app-8khk2ar42dc1_screenshots')
        .getPublicUrl(data.path);

      const uploadedUrl = urlData.publicUrl;

      // 创建聊天会话
      console.time('CreateChatSession'); // ⏱️ 开始计时：创建会话
      const session = await chatSessionApi.create(userProfile.id, uploadedUrl);
      console.timeEnd('CreateChatSession'); // ⏱️ 结束计时：创建会话

      if (!session) {
        throw new Error('创建会话失败');
      }

      console.timeEnd('TotalUploadProcess'); // ⏱️ 结束计时：总流程

      // 跳转到回复建议页面
      navigate(`/replies/${session.id}`);
    } catch (error) {
      console.error('上传失败:', error);
      
      // 记录错误到数据库
      if (userProfile?.id) {
        await supabase.from('error_logs').insert({
          profile_id: userProfile.id,
          error_message: error instanceof Error ? error.message : '未知错误',
          error_stack: error instanceof Error ? error.stack : null,
          error_context: {
            action: 'upload_screenshot',
            file_size: selectedFile?.size,
            file_type: selectedFile?.type
          }
        });
      }
      
      toast({
        title: '加载遇到问题',
        description: '请稍后再试一次，或重新上传截图',
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
    <div className="min-h-screen bg-white">
      {/* 简洁顶部导航 */}
      <header className="border-b border-border/10 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src={logoImage} 
              alt="好好说Logo" 
              className="w-7 h-7 rounded-lg object-cover"
            />
            <h1 className="text-base font-bold">好好说 · <span className="font-normal text-muted-foreground">SayWell</span></h1>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/profile')}>
            <User className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* 主内容 - 居中布局 */}
      <main className="container mx-auto px-6 py-4 xl:py-6">
        <div className="max-w-xl mx-auto">
          
          {/* 大型渐变球体 - 作为主视觉元素 */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-32 h-32 xl:w-40 xl:h-40 gradient-sphere animate-float mb-4" />
            <h2 className="text-2xl xl:text-3xl font-bold text-center mb-3">
              你好，<span className="gradient-text">朋友</span>！
            </h2>
            <p className="text-center text-muted-foreground text-sm xl:text-base">
              今天我能帮你什么？
            </p>
          </div>

          {/* 提示信息 */}
          {!userProfile?.questionnaire_completed && (
            <div className="mb-6 p-4 bg-accent/10 rounded-2xl border border-accent/20">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-accent-foreground shrink-0" />
                <div className="flex-1 flex items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium">完善您的个性画像</span>
                    <span className="text-muted-foreground ml-2">完成问卷后，AI将更好地理解您的沟通风格</span>
                  </p>
                  <Button
                    size="sm"
                    onClick={() => navigate('/questionnaire')}
                    className="button-dark text-xs h-8 shrink-0"
                  >
                    立即完成
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 上传区域 - 简洁白色卡片 */}
          {!previewUrl ? (
            <div className="bg-white rounded-3xl p-8 xl:p-10 shadow-lg border border-border/10">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-border/40 rounded-2xl p-12 text-center hover:border-primary/50 transition-all cursor-pointer"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">上传聊天截图</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  点击或拖拽上传，支持 JPG、PNG 格式
                </p>
                <Button className="button-dark">
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
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-border/10">
              <div className="relative rounded-2xl overflow-hidden border border-border/20 mb-4">
                <img
                  src={previewUrl}
                  alt="预览"
                  className="w-full h-auto max-h-96 object-contain bg-muted/30"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl('');
                  }}
                  className="flex-1 rounded-xl"
                >
                  <X className="w-4 h-4 mr-2" />
                  重新选择
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 button-dark rounded-xl"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      分析中...
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

        </div>
      </main>
    </div>
  );

};

export default HomePage;
