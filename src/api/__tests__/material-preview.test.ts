import { describe, it, expect, vi, afterEach } from 'vitest';
import { previewKind, previewBlob, fileSize } from '../../components/material-preview';
describe('素材预览边界', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('禁止内联执行HTML、SVG和未知格式', () => {
    for (const mime of ['text/html', 'image/svg+xml', 'application/octet-stream'])
      expect(previewKind(mime)).toBe('file');
    expect(previewKind('video/mp4')).toBe('video');
    expect(previewKind('image/png')).toBe('image');
    expect(previewKind('text/plain')).toBe('text');
  });
  it('显示可读大小', () => {
    expect(fileSize(1024)).toBe('1.0 KB');
    expect(fileSize(1048576)).toBe('1.0 MB');
  });
  it('拒绝异常下载响应', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
    await expect(
      previewBlob('http://localhost/file', 'image/png', new AbortController().signal),
    ).rejects.toThrow('预览加载失败');
  });
  it('读取后恢复明确的媒体类型', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('hello')));
    const result = await previewBlob(
      'http://localhost/file',
      'text/plain',
      new AbortController().signal,
    );
    expect(result.type).toBe('text/plain');
    expect(await result.text()).toBe('hello');
  });
  it('超限停止读取，避免大文件占满浏览器内存', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(new Uint8Array(21 * 1024 * 1024))),
    );
    await expect(
      previewBlob('http://localhost/file', 'image/png', new AbortController().signal),
    ).rejects.toThrow('20MB');
  });
});
