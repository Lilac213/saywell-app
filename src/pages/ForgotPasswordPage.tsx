import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/db/supabase';
import { Loader2, ArrowLeft } from 'lucide-react';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [countdown, setCountdown] = useState(0);

  const handleSendCode = async () => {
    if (!phone) {
      toast({ title: '请输入手机号', variant: 'destructive' });
      return;
    }
    
    try {
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      const { error } = await supabase.functions.invoke('send-sms', {
        body: { phone: phone }
      });

      if (error) throw error;

      toast({ title: '验证码已发送' });
    } catch (error) {
      console.error(error);
      setCountdown(0);
      toast({ title: '发送失败', description: error.message, variant: 'destructive' });
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !code || !newPassword) return;

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('auth-operations', {
        body: {
          type: 'reset_password',
          phone: phone,
          code: code,
          password: newPassword
        }
      });

      if (error) throw error;

      toast({ title: '密码重置成功', description: '请使用新密码登录' });
      navigate('/auth');
    } catch (error) {
      toast({ title: '重置失败', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/auth')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle>重置密码</CardTitle>
          </div>
          <CardDescription>通过手机验证码重置您的密码</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <Input 
                id="phone" 
                placeholder="请输入注册手机号" 
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">验证码</Label>
              <div className="flex gap-2">
                <Input 
                  id="code" 
                  placeholder="6位验证码" 
                  value={code}
                  onChange={e => setCode(e.target.value)}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleSendCode}
                  disabled={countdown > 0}
                  className="min-w-[100px]"
                >
                  {countdown > 0 ? `${countdown}s` : '发送验证码'}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input 
                id="new-password" 
                type="password" 
                placeholder="请设置新密码" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              重置密码
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
