import type { Platform } from '../types/api';
export interface Resource {
  key: string;
  title: string;
  subtitle: string;
  path: string;
  icon: string;
  columns: string[];
  group: string;
  readonly?: boolean;
  detail?: string;
}
const resource = (
  key: string,
  title: string,
  path: string,
  icon: string,
  columns: string[],
  group = '业务管理',
  subtitle = '查询与维护平台业务数据',
): Resource => ({ key, title, path, icon, columns, group, subtitle });
export function resources(platform: Platform): Resource[] {
  const p = `/${platform}`;
  if (platform === 'admin')
    return [
      resource(
        'orders',
        '软件订单',
        p + '/orders',
        'bag',
        ['orderNo', 'title', 'amount', 'status', 'receiptStatus'],
        '业务管理',
        '核对订单归属，跟进项目服务与收款状态',
      ),
      resource(
        'projects',
        '软件项目',
        p + '/projects',
        'folder',
        ['title', 'stage', 'progress', 'deliveryDate'],
        '业务管理',
        '从需求到验收，每个交付版本都有记录',
      ),
      resource(
        'users',
        '用户管理',
        p + '/users',
        'users',
        ['displayName', 'phoneMasked', 'platform', 'status'],
        '基础数据',
      ),
      resource(
        'roles',
        '角色管理',
        p + '/roles',
        'shield',
        ['name', 'code', 'platform', 'dataScope', 'status'],
        '基础数据',
      ),
      resource(
        'membership-plans',
        '会员体系',
        p + '/membership-plans',
        'star',
        ['name', 'code', 'status'],
        '基础数据',
      ),
      resource(
        'schools',
        '院校管理',
        p + '/schools',
        'book',
        ['name', 'code', 'region', 'status'],
        '基础数据',
      ),
      resource(
        'majors',
        '专业管理',
        p + '/majors',
        'book',
        ['name', 'code', 'level', 'status'],
        '基础数据',
      ),
      resource(
        'menus',
        '菜单配置',
        p + '/menus',
        'menu',
        ['name', 'platform', 'path', 'sortOrder', 'status'],
        '基础数据',
      ),
      resource(
        'models',
        '大模型配置',
        p + '/models',
        'cpu',
        ['name', 'code', 'provider', 'contextLimit', 'status'],
        '基础数据',
      ),
      resource(
        'model-prices',
        '模型价格',
        p + '/model-prices',
        'wallet',
        ['modelId', 'inputPerMillion', 'outputPerMillion', 'effectiveFrom', 'status'],
        '基础数据',
      ),
      resource(
        'model-keys',
        '模型密钥',
        p + '/model-keys',
        'key',
        ['name', 'modelId', 'maskedSuffix', 'status'],
        '基础数据',
      ),
      resource(
        'storage-configs',
        '对象存储',
        p + '/storages',
        'cloud',
        ['name', 'provider', 'bucket', 'region', 'status'],
        '基础数据',
      ),
      resource(
        'domains',
        '域名配置',
        p + '/domains',
        'globe',
        ['hostname', 'platform', 'certificateRef', 'status'],
        '基础数据',
      ),
      resource(
        'contents',
        '知识库内容',
        p + '/knowledge',
        'book',
        ['title', 'type', 'state', 'indexState'],
        '内容管理',
        '管理可引用的知识内容、文档和视频',
      ),
      resource(
        'categories',
        '内容分类',
        p + '/categories',
        'folder',
        ['name', 'code', 'parentId', 'status'],
        '内容管理',
      ),
      resource('tags', '内容标签', p + '/tags', 'tag', ['name', 'code', 'status'], '内容管理'),
      resource(
        'boards',
        '论坛板块',
        p + '/forum-boards',
        'message',
        ['name', 'code', 'requiresReview', 'status'],
        '社区管理',
      ),
      resource(
        'posts',
        '论坛帖子',
        p + '/posts',
        'message',
        ['title', 'state', 'boardId', 'createdAt'],
        '社区管理',
      ),
      resource(
        'reports',
        '举报审核',
        p + '/reports',
        'shield',
        ['reason', 'state', 'postId', 'createdAt'],
        '社区管理',
      ),
      resource(
        'usage',
        '词元用量',
        p + '/usage',
        'activity',
        [
          'runId',
          'state',
          'effectiveInputTokens',
          'effectiveOutputTokens',
          'netAmount',
          'evidenceSource',
        ],
        '账务管理',
      ),
      resource(
        'adjudications',
        '用量裁决',
        p + '/adjudications',
        'shield',
        ['runId', 'state', 'kind', 'source', 'disputed', 'createdAt'],
        '账务管理',
      ),
      resource(
        'jobs',
        '异步任务',
        p + '/jobs',
        'clock',
        ['kind', 'state', 'progress', 'errorCode', 'createdAt'],
        '运行管理',
      ),
      resource(
        'audit-events',
        '审计记录',
        p + '/audits',
        'file',
        ['action', 'resourceType', 'targetId', 'createdAt'],
        '运行管理',
      ),
      resource(
        'notification-templates',
        '通知模板',
        p + '/notification-templates',
        'bell',
        ['name', 'code', 'channel', 'status'],
        '运行管理',
      ),
    ];
  if (platform === 'partner')
    return [
      resource(
        'orders',
        '我的订单',
        p + '/orders',
        'bag',
        ['orderNo', 'title', 'status', 'amount', 'createdAt'],
        '项目协作',
        '管理名下订单，跟进交付进展',
      ),
      resource(
        'students',
        '名下学生',
        p + '/students',
        'users',
        ['displayName', 'phoneMasked', 'schoolName', 'activeOrderCount'],
        '项目协作',
      ),
      {
        ...resource(
          'projects',
          '交付进度',
          p + '/projects',
          'folder',
          ['title', 'stage', 'progress', 'deliveryDate'],
          '项目协作',
        ),
        readonly: true,
      },
    ];
  return [
    {
      ...resource(
        'projects',
        '我的项目',
        p + '/projects',
        'folder',
        ['title', 'stage', 'progress', 'deliveryDate'],
        '学习空间',
        '查看资料、交付版本与项目进度',
      ),
      readonly: true,
    },
    {
      ...resource(
        'orders',
        '我的订单',
        p + '/orders',
        'bag',
        ['orderNo', 'title', 'status', 'amount'],
        '学习空间',
      ),
      readonly: true,
    },
    {
      ...resource(
        'knowledge',
        '知识库',
        p + '/knowledge',
        'book',
        ['title', 'type', 'categoryId', 'updatedAt'],
        '学习空间',
        '查找文档、视频和项目相关知识',
      ),
      readonly: true,
    },
    resource(
      'posts',
      '交流社区',
      p + '/posts',
      'message',
      ['title', 'boardId', 'state', 'createdAt'],
      '学习空间',
      '交流问题、分享经验，所有帖子遵循审核规则',
    ),
    {
      ...resource(
        'usage',
        '用量账单',
        p + '/usage',
        'activity',
        [
          'state',
          'effectiveInputTokens',
          'effectiveOutputTokens',
          'netAmount',
          'evidenceSource',
          'createdAt',
        ],
        '账户',
      ),
      readonly: true,
    },
  ];
}
export const platformNames: Record<Platform, string> = {
  admin: '知项管理后台',
  student: '知项学习平台',
  partner: '知项项目协作',
};
