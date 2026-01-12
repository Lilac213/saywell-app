import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { supabase } from '@/db/supabase';
import { ArrowLeft, Loader2, ExternalLink, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AIFeedback } from '@/types/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AIFeedbackListPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, loading: profileLoading } = useUserProfile();
  const { toast } = useToast();
  const [feedbacks, setFeedbacks] = useState<AIFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (!profileLoading) {
      if (!userProfile?.is_tester && userProfile?.role !== 'admin') {
        toast({
          title: "无权访问",
          description: "该页面仅供测试人员访问",
          variant: "destructive"
        });
        navigate('/');
        return;
      }
      fetchFeedbacks();
    }
  }, [profileLoading, userProfile]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ai_feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('feedback_type', filterType);
      }
      if (filterStatus !== 'all') {
        query = query.eq('handle_status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error: any) {
      console.error('Error fetching feedbacks:', error);
      toast({
        title: "获取反馈列表失败",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.is_tester || userProfile?.role === 'admin') {
      fetchFeedbacks();
    }
  }, [filterType, filterStatus]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">未处理</Badge>;
      case 'tuned':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">已调教</Badge>;
      case 'verified':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">已验证</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      role_confusion: '角色混淆',
      analysis_error: '分析错误',
      style_mismatch: '回复风格不符',
      other: '其他'
    };
    return map[type] || type;
  };

  if (profileLoading || loading && feedbacks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/profile')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI反馈调教中心</h1>
              <p className="text-sm text-muted-foreground">
                共 {feedbacks.length} 条反馈记录
              </p>
            </div>
          </div>
          <Button onClick={fetchFeedbacks} variant="outline" size="sm">
            <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">筛选:</span>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="反馈类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有类型</SelectItem>
                <SelectItem value="role_confusion">角色混淆</SelectItem>
                <SelectItem value="analysis_error">分析错误</SelectItem>
                <SelectItem value="style_mismatch">回复风格不符</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="处理状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有状态</SelectItem>
                <SelectItem value="pending">未处理</SelectItem>
                <SelectItem value="tuned">已调教</SelectItem>
                <SelectItem value="verified">已验证</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Feedback List */}
        <Card>
          <CardHeader>
            <CardTitle>反馈列表</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead className="w-[120px]">类型</TableHead>
                    <TableHead className="max-w-[300px]">问题描述</TableHead>
                    <TableHead className="w-[100px]">附件</TableHead>
                    <TableHead className="w-[150px]">提交时间</TableHead>
                    <TableHead className="w-[150px]">AI结果ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbacks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        暂无反馈数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    feedbacks.map((feedback) => (
                      <TableRow key={feedback.id}>
                        <TableCell>{getStatusBadge(feedback.handle_status)}</TableCell>
                        <TableCell>{getTypeLabel(feedback.feedback_type)}</TableCell>
                        <TableCell className="truncate max-w-[300px]" title={feedback.content}>
                          {feedback.content}
                        </TableCell>
                        <TableCell>
                          {feedback.attach_file ? (
                            <a 
                              href={feedback.attach_file} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              查看 <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{new Date(feedback.created_at).toLocaleString('zh-CN')}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {feedback.ai_result_id.substring(0, 8)}...
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIFeedbackListPage;
