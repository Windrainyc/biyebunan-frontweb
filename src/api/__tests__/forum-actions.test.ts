import { describe, expect, it } from 'vitest';
import { studentPostActions } from '../../config/forum-actions';

describe('学生帖子可用操作', () => {
  it('其他作者和未登录用户看不到写操作', () => {
    expect(studentPostActions({ authorId: 'other', state: 'PUBLISHED' }, 'me')).toEqual({
      edit: false,
      remove: false,
    });
    expect(studentPostActions({ state: 'PUBLISHED' })).toEqual({ edit: false, remove: false });
  });
  it('本人待审核和已发布帖子可以编辑删除', () => {
    for (const state of ['PENDING', 'PUBLISHED']) {
      expect(studentPostActions({ authorId: 'me', state }, 'me')).toEqual({
        edit: true,
        remove: true,
      });
    }
  });
  it('隐藏帖子只允许作者主动删除，锁定和未知状态不展示写操作', () => {
    expect(studentPostActions({ authorId: 'me', state: 'HIDDEN' }, 'me')).toEqual({
      edit: false,
      remove: true,
    });
    for (const state of ['LOCKED', 'FUTURE_STATE', undefined]) {
      expect(studentPostActions({ authorId: 'me', state }, 'me')).toEqual({
        edit: false,
        remove: false,
      });
    }
  });
});
