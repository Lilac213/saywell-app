import HomePage from './pages/HomePage';
import QuestionnairePage from './pages/QuestionnairePage';
import RepliesPage from './pages/RepliesPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';
import AuthPage from './pages/AuthPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AdminPage from './pages/AdminPage';
import PrivacyPage from './pages/PrivacyPage';
import AgreementPage from './pages/AgreementPage';
import AIFeedbackListPage from './pages/AIFeedbackListPage';
import AdminFeedbackPage from './pages/AdminFeedbackPage';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: '首页',
    path: '/',
    element: <HomePage />
  },
  {
    name: '问卷',
    path: '/questionnaire',
    element: <QuestionnairePage />
  },
  {
    name: '回复建议',
    path: '/replies/:sessionId',
    element: <RepliesPage />
  },
  {
    name: '历史记录',
    path: '/history',
    element: <HistoryPage />
  },
  {
    name: '我的画像',
    path: '/profile',
    element: <ProfilePage />
  },
  {
    name: '登录/注册',
    path: '/auth',
    element: <AuthPage />,
    visible: false
  },
  {
    name: '忘记密码',
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
    visible: false
  },
  {
    name: '修改密码',
    path: '/change-password',
    element: <ChangePasswordPage />,
    visible: false
  },
  {
    name: '用户管理',
    path: '/admin',
    element: <AdminPage />,
    visible: false
  },
  {
    name: 'AI反馈管理',
    path: '/admin/feedbacks',
    element: <AdminFeedbackPage />,
    visible: false
  },
  {
    name: 'AI反馈调教',
    path: '/feedback-list',
    element: <AIFeedbackListPage />,
    visible: false
  },
  {
    name: '隐私政策',
    path: '/privacy',
    element: <PrivacyPage />,
    visible: false
  },
  {
    name: '用户协议',
    path: '/agreement',
    element: <AgreementPage />,
    visible: false
  }
];

export default routes;
