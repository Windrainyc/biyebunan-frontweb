import type { Row } from '../types/api';

/** 页面操作提示与服务端帖子状态机一致；真正的所有权、CAS 和状态校验仍由接口执行。 */
export function studentPostActions(post: Row, userId?: string) {
  const owned = !!userId && post.authorId === userId;
  return {
    edit: owned && ['PENDING', 'PUBLISHED'].includes(String(post.state)),
    remove: owned && ['PENDING', 'PUBLISHED', 'HIDDEN'].includes(String(post.state)),
  };
}
