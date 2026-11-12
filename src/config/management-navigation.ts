/** 原型的一级栏目与实际已授权路由对应；子入口永远取服务端可见集合。 */
export interface ManagementLink {
  key: string;
  title: string;
  path: string;
  icon: string;
}
const sections = [
  { key: 'orders', title: '订单管理', icon: 'bag', group: '工作空间', keys: ['orders'] },
  { key: 'projects', title: '项目交付', icon: 'folder', group: '工作空间', keys: ['projects'] },
  {
    key: 'users',
    title: '用户与会员',
    icon: 'users',
    group: '内容与用户',
    keys: ['users', 'roles', 'membership-plans'],
  },
  {
    key: 'community',
    title: '论坛管理',
    icon: 'message',
    group: '内容与用户',
    keys: ['posts', 'reports', 'boards'],
  },
  {
    key: 'content',
    title: '知识与素材',
    icon: 'book',
    group: '内容与用户',
    keys: ['contents', 'materials', 'categories', 'tags', 'material-categories'],
  },
  {
    key: 'ai',
    title: '模型与计费',
    icon: 'sparkles',
    group: '运营与系统',
    keys: ['models', 'model-prices', 'model-keys', 'usage', 'adjudications', 'chat-audit'],
  },
  {
    key: 'analytics',
    title: '统计分析',
    icon: 'activity',
    group: '运营与系统',
    keys: ['statistics', 'exports'],
  },
  {
    key: 'notifications',
    title: '通知中心',
    icon: 'bell',
    group: '运营与系统',
    keys: ['notifications'],
  },
  { key: 'activity', title: '用户活动', icon: 'activity', group: '运营与系统', keys: ['activity'] },
  {
    key: 'settings',
    title: '基础配置',
    icon: 'settings',
    group: '运营与系统',
    keys: [
      'profile',
      'banners',
      'service-packages',
      'schools',
      'majors',
      'menus',
      'storage-configs',
      'domains',
      'notification-templates',
      'jobs',
      'audit-events',
    ],
  },
];
export function managementSections(links: readonly ManagementLink[]) {
  return [...sections]
    .sort(
      (a, b) =>
        [
          'orders',
          'projects',
          'content',
          'users',
          'community',
          'analytics',
          'ai',
          'notifications',
          'activity',
          'settings',
        ].indexOf(a.key) -
        [
          'orders',
          'projects',
          'content',
          'users',
          'community',
          'analytics',
          'ai',
          'notifications',
          'activity',
          'settings',
        ].indexOf(b.key),
    )
    .map((section) => ({
      ...section,
      links: section.keys.flatMap((key) => links.filter((link) => link.key === key)),
    }))
    .filter((section) => section.links.length);
}
