import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, ArrowLeft, ShieldAlert, FlaskConical, MessageSquare } from 'lucide-react';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [feedbackEnabled, setFeedbackEnabled] = useState(true);

  useEffect(() => {
    fetchUsers();
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'ai_feedback_enabled')
      .single();
    
    if (data) {
      setFeedbackEnabled(data.value);
    }
  };

  const toggleFeedbackSystem = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('app_config')
        .update({ value: enabled })
        .eq('key', 'ai_feedback_enabled');

      if (error) throw error;
      setFeedbackEnabled(enabled);
      toast({ title: enabled ? 'AI反馈系统已开启' : 'AI反馈系统已关闭' });
    } catch (error: any) {
      toast({ title: '设置失败', description: error.message, variant: 'destructive' });
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        method: 'GET',
        headers: {
          // Pass current session auth
        }
      });
      if (error) throw error;
      setUsers(data.users || []);
    } catch (error: any) {
      console.error(error);
      toast({ title: '加载失败', description: '无法获取用户列表，请确认权限', variant: 'destructive' });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTester = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('admin-users?action=toggle_tester', {
        method: 'POST',
        body: { userId, isTester: !currentStatus }
      });

      if (error) throw error;

      toast({ title: '更新成功', description: `用户已${!currentStatus ? '设为' : '取消'}测试人员` });
      setUsers(users.map(u => u.id === userId ? { ...u, is_tester: !currentStatus } : u));
    } catch (error: any) {
      toast({ title: '更新失败', description: error.message, variant: 'destructive' });
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !newPassword) return;

    try {
      const { error } = await supabase.functions.invoke('admin-users?action=reset_password', {
        method: 'POST',
        body: { userId: resetUserId, newPassword }
      });

      if (error) throw error;

      toast({ title: '重置成功' });
      setResetUserId(null);
      setNewPassword('');
    } catch (error) {
      toast({ title: '重置失败', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold">用户管理 (管理员)</h1>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
            <span className="text-sm font-medium">AI反馈系统</span>
            <Switch 
              checked={feedbackEnabled}
              onCheckedChange={toggleFeedbackSystem}
            />
          </div>
          <Button onClick={() => navigate('/admin/feedbacks')} variant="outline" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            AI反馈管理
          </Button>
        </div>
      </div>

      <div className="bg-background rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>账号</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>测试人员</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead>最后登录</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-mono text-xs">{user.id.substring(0, 8)}...</TableCell>
                <TableCell>{user.email || user.phone}</TableCell>
                <TableCell>
                  <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                    {user.role === 'admin' ? '管理员' : '用户'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={user.is_tester || false}
                      onCheckedChange={() => handleToggleTester(user.id, user.is_tester)}
                    />
                    {user.is_tester && <Badge variant="outline" className="border-green-500 text-green-500"><FlaskConical className="w-3 h-3 mr-1" />测试员</Badge>}
                  </div>
                </TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : '-'}</TableCell>
                <TableCell>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setResetUserId(user.id)}>
                        <ShieldAlert className="w-3 h-3 mr-1" /> 重置密码
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>重置用户密码</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">用户: {user.email || user.phone}</p>
                        <Input 
                          placeholder="输入新密码" 
                          value={newPassword} 
                          onChange={e => setNewPassword(e.target.value)}
                        />
                        <Button onClick={handleResetPassword} className="w-full">确认重置</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminPage;
