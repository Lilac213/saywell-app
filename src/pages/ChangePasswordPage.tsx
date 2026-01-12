import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import { Loader2, ArrowLeft } from 'lucide-react';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;

    setLoading(true);
    try {
      // Supabase doesn't enforce old password check on 'updateUser', but it's good practice to verify.
      // However, to verify old password, we need to sign in again or use an RPC.
      // Easiest way: Try to sign in with current user email/phone and OLD password.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.phone) throw new Error('Not logged in');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        phone: user.phone,
        password: oldPassword
      });

      if (signInError) throw new Error('旧密码错误');

      // If success, update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      toast({ title: '密码修改成功' });
      navigate('/');
    } catch (error) {
      toast({ title: '修改失败', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-md">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> 返回
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>为了安全，请定期修改您的密码</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="old-pass">旧密码</Label>
              <Input 
                id="old-pass" 
                type="password"
                placeholder="请输入旧密码" 
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pass">新密码</Label>
              <Input 
                id="new-pass" 
                type="password"
                placeholder="请输入新密码" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认修改
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePasswordPage;
