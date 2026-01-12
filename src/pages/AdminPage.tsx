import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import { Loader2, ArrowLeft, ShieldAlert } from 'lucide-react';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

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
    } catch (error) {
      console.error(error);
      toast({ title: '加载失败', description: '无法获取用户列表，请确认权限', variant: 'destructive' });
      navigate('/');
    } finally {
      setLoading(false);
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
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold">用户管理 (管理员)</h1>
      </div>

      <div className="bg-background rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead>最后登录</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-mono text-xs">{user.id}</TableCell>
                <TableCell>{user.phone}</TableCell>
                <TableCell>{new Date(user.created_at).toLocaleString()}</TableCell>
                <TableCell>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : '-'}</TableCell>
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
                        <p className="text-sm text-muted-foreground">用户: {user.phone}</p>
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
