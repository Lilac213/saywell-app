import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { chatSessionApi } from '@/db/api';
import { ArrowLeft, Clock, Image as ImageIcon } from 'lucide-react';
import type { ChatSession } from '@/types/types';

const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useUserProfile();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [userProfile]);

  const loadHistory = async () => {
    if (!userProfile) {
      setLoading(false);
      return;
    }

    try {
      const data = await chatSessionApi.getByUserProfile(userProfile.id, 50);
      setSessions(data);
    } catch (error) {
      console.error('加载历史记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/30 to-background">
      {/* 顶部导航 */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold ml-2">历史记录</h1>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-6 xl:py-8">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">加载中...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-muted rounded-full mb-4">
                <Clock className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">暂无历史记录</h2>
              <p className="text-muted-foreground mb-6">上传聊天截图后，记录会显示在这里</p>
              <Button onClick={() => navigate('/')}>开始使用</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session, index) => (
                <Card
                  key={session.id}
                  className="cursor-pointer hover:shadow-lg transition-all animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                  onClick={() => navigate(`/replies/${session.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* 缩略图 */}
                      <div className="w-20 h-20 xl:w-24 xl:h-24 flex-shrink-0 rounded-lg overflow-hidden border border-border bg-muted">
                        {session.screenshot_url ? (
                          <img
                            src={session.screenshot_url}
                            alt="截图"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* 信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-base truncate">
                            {session.extracted_text || '聊天记录'}
                          </h3>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(session.created_at)}
                          </span>
                        </div>
                        {session.extracted_text && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {session.extracted_text}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HistoryPage;
