import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { ArrowLeft, User, Sparkles, RefreshCw } from 'lucide-react';
import logoImage from '@/assets/logo.png';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useUserProfile();

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>未找到用户画像</CardTitle>
            <CardDescription>请先完成问卷创建您的个性化画像</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/questionnaire')} className="w-full">
              开始问卷
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
            <img 
              src={logoImage} 
              alt="好好说Logo" 
              className="w-7 h-7 rounded-lg object-cover"
            />
            <h1 className="text-base font-bold">好好说 · <span className="font-normal text-muted-foreground">SayWell</span></h1>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full">
            <User className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-6 xl:py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 用户信息卡片 */}
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">个性化画像</CardTitle>
                  <CardDescription>
                    创建于 {new Date(userProfile.created_at).toLocaleDateString('zh-CN')}
                  </CardDescription>
                </div>
                {userProfile.questionnaire_completed && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    已完成
                  </Badge>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* 重新填写问卷按钮 - 压缩版 */}
          <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">完善个性化画像</p>
                  <p className="text-xs text-muted-foreground">
                    填写问卷让AI更了解您的风格
                  </p>
                </div>
                <Button onClick={() => navigate('/questionnaire')} size="sm">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  填写问卷
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 性格特征 */}
          {userProfile.personality_traits &&
            Object.keys(userProfile.personality_traits).length > 0 && (
              <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    性格特征
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 性别和星座一行 */}
                  <div className="grid grid-cols-2 gap-4">
                    {userProfile.personality_traits['性别'] && (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">性别：</span>
                        <span className="text-sm text-muted-foreground">
                          {String(userProfile.personality_traits['性别'])}
                        </span>
                      </div>
                    )}
                    {userProfile.personality_traits['星座'] && (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">星座：</span>
                        <span className="text-sm text-muted-foreground">
                          {String(userProfile.personality_traits['星座'])}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* 年龄段和MBTI一行 */}
                  <div className="grid grid-cols-2 gap-4">
                    {userProfile.personality_traits['年龄段'] && (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">年龄段：</span>
                        <span className="text-sm text-muted-foreground">
                          {String(userProfile.personality_traits['年龄段'])}
                        </span>
                      </div>
                    )}
                    {userProfile.personality_traits['MBTI'] && (
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">MBTI：</span>
                        <span className="text-sm text-muted-foreground">
                          {String(userProfile.personality_traits['MBTI'])}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* 其他性格特征 */}
                  {Object.entries(userProfile.personality_traits)
                    .filter(([key]) => !['性别', '星座', '年龄段', 'MBTI'].includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="flex flex-col xl:flex-row xl:items-center gap-2">
                        <span className="font-medium text-sm min-w-24">{key}：</span>
                        <span className="text-sm text-muted-foreground flex-1">
                          {typeof value === 'object' && value !== null
                            ? Object.entries(value)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(', ')
                            : String(value)}
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}

          {/* 语言习惯 */}
          {userProfile.language_habits &&
            Object.keys(userProfile.language_habits).length > 0 && (
              <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    语言习惯
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(userProfile.language_habits).map(([key, value]) => (
                    <div key={key} className="flex flex-col xl:flex-row xl:items-start gap-2">
                      <span className="font-medium text-sm min-w-24">{key}：</span>
                      <span className="text-sm text-muted-foreground flex-1">
                        {Array.isArray(value) ? value.join('、') : String(value)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

          {/* 背景故事 */}
          {userProfile.background_story && (
            <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  背景故事
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {userProfile.background_story}
                </p>
              </CardContent>
            </Card>
          )}

          {/* 操作按钮 */}
          {/* 说明 */}
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>您的画像会随着使用不断优化</p>
            <p>我们会根据您选择的回复和反馈持续学习您的偏好</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
