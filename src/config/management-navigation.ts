/** 原型的一级栏目与实际已授权路由对应；子入口永远取服务端可见集合。 */
export interface ManagementLink {
  key: string;
  title: string;
  path: string;
  icon: string;
}
const sections = [
  { key: 'orders', title: '软件订单', icon: 'bag', group: '业务管理', keys: ['orders'] },
  { key: 'projects', title: '软件项目', icon: 'folder', group: '业务管理', keys: ['projects'] },
  {
    key: 'users',
    title: '用户与角色',
    icon: 'users',
    group: '业务管理',
    keys: ['users', 'roles', 'membership-plans'],
  },
  {
    key: 'community',
    title: '论坛管理',
    icon: 'message',
    group: '业务管理',
    keys: ['posts', 'reports', 'boards'],
  },
  {
    key: 'content',
    title: '知识库内容',
    icon: 'book',
    group: '内容与智能',
    keys: ['contents', 'categories', 'tags'],
  },
  {
    key: 'ai',
    title: '智能与词元计费',
    icon: 'sparkles',
    group: '内容与智能',
    keys: ['models', 'model-prices', 'model-keys', 'usage', 'adjudications', 'chat-audit'],
  },
  {
    key: 'analytics',
    title: '数据统计',
    icon: 'activity',
    group: '内容与智能',
    keys: ['statistics', 'exports'],
  },
  {
    key: 'settings',
    title: '基础数据配置',
    icon: 'settings',
    group: '系统',
    keys: [
      'materials',
      'material-categories',
      'schools',
      'majors',
      'menus',
      'storage-configs',
      'domains',
      'notification-templates',
      'jobs',
      'audit-events',
      'notifications',
    ],
  },
];
export function managementSections(links: readonly ManagementLink[]) {
  return sections
    .map((section) => ({
      ...section,
      links: section.keys.flatMap((key) => links.filter((link) => link.key === key)),
    }))
    .filter((section) => section.links.length);
}
