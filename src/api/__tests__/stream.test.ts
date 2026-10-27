import { describe, it, expect } from 'vitest';
import { SseParser } from '../stream';
describe('SSE协议解析', () => {
  it('跨分片保留事件，忽略心跳并兼容CRLF', () => {
    const p = new SseParser();
    expect(p.push(':heartbeat\r\n\r\ndata: {"text":"答')).toEqual([]);
    expect(p.push('案"}\r\n\r')).toEqual([]);
    expect(p.push('\ndata: 第二条\n\n')).toEqual(['{"text":"答案"}', '第二条']);
  });
  it('多行数据按协议拼接', () => {
    expect(new SseParser().push('id: a\nevent: delta\ndata: 第一行\ndata: 第二行\n\n')).toEqual([
      '第一行\n第二行',
    ]);
  });
  it('拒绝不终止的超长帧', () => {
    expect(() => new SseParser().push('x'.repeat(2000001))).toThrow();
  });
});
