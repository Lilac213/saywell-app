import HomePage from './pages/HomePage';
import QuestionnairePage from './pages/QuestionnairePage';
import RepliesPage from './pages/RepliesPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';
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
  }
];

export default routes;
