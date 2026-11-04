import { operation } from './contract';
import type { Platform } from '../types/api';
/** 专用页面和通用资源页采用同一接口权限规则，导航不授予服务端权限。 */
export function utilityNavigation(platform: Platform, permissions: readonly string[]) {
  const definitions = [
    {
      key: 'activity',
      title: '埋点数据',
      icon: 'activity',
      method: 'GET',
      endpoint: '/admin/activity',
      platforms: ['admin'],
    },
    {
      key: 'search',
      title: '知识检索',
      icon: 'book',
      method: 'GET',
      endpoint: '/student/knowledge-search',
      platforms: ['student'],
    },
    {
      key: 'exports',
      title: '数据导出',
      icon: 'file',
      method: 'POST',
      endpoint: `/${platform}/exports`,
      platforms: ['admin', 'partner'],
    },
    {
      key: 'chat-audit',
      title: '答疑会话审计',
      icon: 'shield',
      method: 'GET',
      endpoint: '/admin/conversations',
      platforms: ['admin'],
    },
    {
      key: 'profile',
      title: '我的账户',
      icon: 'users',
      method: 'GET',
      endpoint: `/${platform}/me`,
      platforms: ['student', 'partner'],
    },
    {
      key: 'bind-order',
      title: '绑定订单',
      icon: 'bag',
      method: 'POST',
      endpoint: '/student/order-bindings',
      platforms: ['student'],
    },
    {
      key: 'statistics',
      title: '数据统计',
      icon: 'activity',
      method: 'GET',
      endpoint: `/${platform}/statistics`,
      platforms: ['admin', 'student', 'partner'],
    },
    {
      key: 'notifications',
      title: '消息通知',
      icon: 'bell',
      method: 'GET',
      endpoint: `/${platform}/notifications`,
      platforms: ['admin', 'student', 'partner'],
    },
    {
      key: 'chat',
      title: '在线答疑',
      icon: 'message',
      method: 'GET',
      endpoint: '/student/conversations',
      platforms: ['student'],
    },
  ];
  return definitions
    .filter((entry) => {
      if (!entry.platforms.includes(platform)) return false;
      const op = operation(entry.method, entry.endpoint);
      return !!op && (!op.permission || permissions.includes(op.permission));
    })
    .map((entry) => ({ ...entry, path: `/${platform}/${entry.key}` }));
}
