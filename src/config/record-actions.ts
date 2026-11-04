import { auth } from '../api/client';
import { operation } from './contract';
import { jobRecovery } from './job-recovery';
import type { Row } from '../types/api';
const definitions: Record<string, { path: string; title: string; method?: string }[]> = {
  orders: [
    { path: 'orders/{id}/transition', title: '变更订单状态' },
    { path: 'orders/{id}/receipt', title: '核验收款' },
    { path: 'orders/{id}/assignment', title: '分配中介' },
  ],
  projects: [
    { path: 'projects/{id}/deliveries', title: '交付版本管理', method: 'GET' },
    { path: 'projects/{id}/stage', title: '推进项目阶段' },
    { path: 'projects/{id}/acceptance', title: '提交项目验收' },
  ],
  posts: [
    { path: 'posts/{id}/moderation', title: '审核或管理帖子' },
    { path: 'posts/{id}/reports', title: '举报帖子' },
  ],
  jobs: [{ path: 'jobs/{id}/retry', title: '恢复失败任务' }],
  reports: [{ path: 'reports/{id}/decision', title: '处理举报' }],
  comments: [{ path: 'comments/{id}/moderation', title: '管理评论' }],
  adjudications: [{ path: 'adjudications/{id}/decision', title: '复核用量裁决' }],
};
definitions.contents = [
  { path: 'knowledge/{id}/submit-review', title: '提交审核' },
  { path: 'knowledge/{id}/publish', title: '发布内容' },
  { path: 'knowledge/{id}/withdraw', title: '撤回发布' },
  { path: 'knowledge/{id}/reindex', title: '重新建立索引' },
];
for (const [key, path] of Object.entries({
  models: 'models',
  'storage-configs': 'storages',
  domains: 'domains',
})) {
  (definitions[key] ||= []).push({ path: `${path}/{id}/test`, title: '验证连接配置' });
}
(definitions['model-keys'] ||= []).push({ path: 'model-keys/{id}/rotate', title: '更换模型密钥' });

export function recordActions(resourceKey: string, record: Row) {
  return (definitions[resourceKey] || [])
    .map((d) => ({ ...d, path: `/${auth.platform}/${d.path}` }))
    .filter((d) => {
      // 举报结论只能从OPEN产生；终态不再提供重复处理入口，服务端仍执行CAS与状态校验。
      if (
        resourceKey === 'jobs' &&
        !jobRecovery(String(record.kind || ''), String(record.state || '')).retry
      )
        return false;
      if (resourceKey === 'reports' && record.state !== 'OPEN') return false;
      if (resourceKey === 'adjudications' && record.state !== 'PENDING') return false;
      if (d.path.endsWith('/acceptance') && record.stage !== 'ACCEPTANCE') return false;
      if (
        d.path.endsWith('/knowledge/{id}/submit-review') &&
        !['DRAFT', 'WITHDRAWN'].includes(String(record.state))
      )
        return false;
      if (d.path.endsWith('/knowledge/{id}/publish') && record.state !== 'REVIEW') return false;
      if (
        d.path.endsWith('/knowledge/{id}/withdraw') &&
        !['REVIEW', 'PUBLISHED'].includes(String(record.state))
      )
        return false;
      if (
        d.path.endsWith('/receipt') &&
        (record.receiptStatus !== 'UNCONFIRMED' || record.status !== 'CONFIRMED')
      )
        return false;
      const o = operation(d.method || 'POST', d.path);
      return o && (!o.permission || auth.permissions.includes(o.permission));
    });
}
