import { ApiError, request } from './client';
import type { Platform } from '../types/api';
import { previewKind } from '../components/material-preview';

export interface MediaGrant {
  url: string;
  expiresAt: string;
}

/** 优先使用播放副本；尚无副本时，仅尝试浏览器支持且已扫描通过的原视频。 */
export async function videoPlayback(platform: Platform, assetId: string): Promise<MediaGrant> {
  const path = `/${platform}/assets/${assetId}`;
  try {
    return await request<MediaGrant>(`${path}/download`, {
      method: 'POST',
      query: { variant: 'PLAYBACK' },
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.problem.code !== 'VIDEO_NOT_READY') throw error;
    const asset = await request<{ mimeType: string; state: string }>(path);
    if (asset.state !== 'READY' || previewKind(asset.mimeType) !== 'video') throw error;
    // 原件签名仍由服务端检查内容权限、扫描状态和签发限额。
    return request<MediaGrant>(`${path}/download`, { method: 'POST' });
  }
}
