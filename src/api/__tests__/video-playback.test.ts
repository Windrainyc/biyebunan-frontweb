import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../client', () => ({
  ApiError: class extends Error {
    constructor(
      public status: number,
      public problem: { code: string },
    ) {
      super(problem.code);
    }
  },
  request: vi.fn(),
}));
import { request, ApiError } from '../client';
import { videoPlayback } from '../video-playback';
const mock = vi.mocked(request);
const grant = { url: 'https://example.test/video', expiresAt: '2026-11-12T12:00:00Z' };
beforeEach(() => mock.mockReset());
describe('私有视频播放授权', () => {
  it('已有播放副本只请求一次授权', async () => {
    mock.mockResolvedValueOnce(grant);
    expect(await videoPlayback('student', 'asset')).toEqual(grant);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('没有副本时通过已扫描MP4原件授权播放', async () => {
    mock
      .mockRejectedValueOnce(new ApiError(503, { code: 'VIDEO_NOT_READY' }))
      .mockResolvedValueOnce({ mimeType: 'video/mp4', state: 'READY' })
      .mockResolvedValueOnce(grant);
    expect(await videoPlayback('student', 'asset')).toEqual(grant);
    expect(mock).toHaveBeenLastCalledWith('/student/assets/asset/download', { method: 'POST' });
  });
  it.each([401, 403, 429])('鉴权或限额错误%s不能绕过申请原件', async (status) => {
    const error = new ApiError(status, { code: 'DENIED' });
    mock.mockRejectedValueOnce(error);
    await expect(videoPlayback('student', 'asset')).rejects.toBe(error);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it.each([
    { mimeType: 'video/mp4', state: 'QUARANTINED' },
    { mimeType: 'video/quicktime', state: 'READY' },
  ])('不播放未扫描或不支持的原件 %j', async (asset) => {
    const error = new ApiError(503, { code: 'VIDEO_NOT_READY' });
    mock.mockRejectedValueOnce(error).mockResolvedValueOnce(asset);
    await expect(videoPlayback('student', 'asset')).rejects.toBe(error);
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
