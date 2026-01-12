import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const AgreementPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> 返回
      </Button>
      <h1 className="text-3xl font-bold mb-6">用户协议</h1>
      <div className="prose dark:prose-invert">
        <p>欢迎使用好好说（SayWell）。</p>
        <h3>1. 服务内容</h3>
        <p>本应用利用人工智能技术为您提供沟通辅助建议。</p>
        <h3>2. 用户行为规范</h3>
        <p>您不得利用本服务从事违法违规活动。</p>
        <h3>3. 免责声明</h3>
        <p>AI生成的建议仅供参考，不代表专业法律或心理咨询意见。</p>
        {/* More content... */}
      </div>
    </div>
  );
};

export default AgreementPage;
