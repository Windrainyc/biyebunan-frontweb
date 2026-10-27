import { describe, expect, it } from 'vitest';
import { mergeMessagePage } from '../messages';

describe('聊天历史分页', () => {
  it('新消息倒序页显示问题在前、回答在后，且不改变原始响应', () => {
    const response = [
      { id: 'answer', role: 'ASSISTANT' },
      { id: 'question', role: 'USER' },
    ];
    expect(mergeMessagePage(response, []).map((x) => x.id)).toEqual(['question', 'answer']);
    expect(response[0]?.id).toBe('answer');
  });
  it('加载更早页时去掉因新消息插入产生的重叠，保留当前内容', () => {
    const existing = [{ id: 'q2', text: '原内容' }, { id: 'a2' }];
    expect(
      mergeMessagePage([{ id: 'q2', text: '重叠' }, { id: 'a1' }, { id: 'q1' }], existing),
    ).toEqual([{ id: 'q1' }, { id: 'a1' }, ...existing]);
  });
});
