import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> 返回
      </Button>
      <h1 className="text-3xl font-bold mb-6">隐私政策</h1>
      <div className="prose dark:prose-invert">
        <p>最后更新日期：2026年1月12日</p>
        <h3>1. 信息收集</h3>
        <p>我们需要收集您的手机号码以完成注册和登录，确保账号安全。</p>
        <h3>2. 信息使用</h3>
        <p>您的信息仅用于账号验证和提供服务，我们不会向第三方出售您的个人信息。</p>
        <h3>3. 信息安全</h3>
        <p>我们采取严格的安全措施保护您的数据。</p>
        {/* More content... */}
      </div>
    </div>
  );
};

export default PrivacyPage;
