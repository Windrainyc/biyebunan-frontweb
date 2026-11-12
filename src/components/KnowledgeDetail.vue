<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { auth, request, errorText } from '../api/client';
import { videoPlayback, type MediaGrant } from '../api/video-playback';
import type { Row } from '../types/api';
import AssetCover from './AssetCover.vue';
import MarkdownContent from './MarkdownContent.vue';
const props = defineProps<{ content: Row; readonly?: boolean }>();
defineEmits<{ changed: [] }>();
const video = ref(''),
  error = ref(''),
  busy = ref(false),
  downloadUrl = ref('');
const player = ref<HTMLVideoElement>();
let generation = 0,
  position = 0;
let downloadTimer: ReturnType<typeof setTimeout> | undefined;
async function play() {
  const current = ++generation;
  position = player.value?.currentTime || position;
  busy.value = true;
  error.value = '';
  try {
    const grant = await videoPlayback(auth.platform, String(props.content.assetId));
    if (current !== generation) return;
    const url = new URL(grant.url);
    if (!['https:', 'http:'].includes(url.protocol) || Date.parse(grant.expiresAt) <= Date.now())
      throw Error('视频授权已过期，请重试');
    video.value = url.href;
    // 签名限制后续请求，不应在60秒后移除正在播放的元素。
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) busy.value = false;
  }
}
function restorePosition() {
  if (player.value && position > 0)
    player.value.currentTime = Math.min(position, player.value.duration || position);
}
function mediaError() {
  position = player.value?.currentTime || position;
  error.value =
    player.value?.error?.code === 4
      ? '浏览器无法播放此视频格式，请下载原文件查看。'
      : '视频加载中断，点击重新加载视频后可继续播放。';
}
async function download() {
  error.value = '';
  const current = generation;
  try {
    const grant = await request<MediaGrant>(
      `/${auth.platform}/assets/${props.content.assetId}/download`,
      { method: 'POST' },
    );
    if (current !== generation) return;
    const url = new URL(grant.url),
      remaining = Date.parse(grant.expiresAt) - Date.now();
    if (!['https:', 'http:'].includes(url.protocol) || remaining <= 0)
      throw Error('文件授权已过期，请重试');
    downloadUrl.value = url.href;
    clearTimeout(downloadTimer);
    downloadTimer = setTimeout(() => (downloadUrl.value = ''), remaining);
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  }
}
watch(
  () => [props.content.id, props.content.version],
  () => {
    generation++;
    position = 0;
    video.value = '';
    error.value = '';
    downloadUrl.value = '';
    clearTimeout(downloadTimer);
    if (props.content.type === 'VIDEO' && props.content.assetId) void play();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
  clearTimeout(downloadTimer);
});
</script>
<template>
  <div class="knowledge-content">
    <section
      v-if="content.type === 'VIDEO' && content.assetId"
      class="knowledge-player"
      aria-label="作品视频"
    >
      <video
        v-if="video"
        ref="player"
        :src="video"
        controls
        playsinline
        preload="metadata"
        @loadedmetadata="restorePosition"
        @error="mediaError"
      />
      <div v-else class="video-loading">
        {{ busy ? '正在加载视频…' : '视频暂不可播放'
        }}<button v-if="!busy" class="button" @click="play">重新加载视频</button>
      </div>
    </section>
    <div v-else-if="content.coverAssetId" class="knowledge-content-cover">
      <AssetCover :asset-id="content.coverAssetId" :alt="String(content.title)" />
    </div>
    <p v-if="error" class="error" role="alert">
      {{ error }}
      <button v-if="content.type === 'VIDEO'" class="text-button" :disabled="busy" @click="play">
        重新加载视频
      </button>
    </p>
    <MarkdownContent v-if="content.markdown" :text="String(content.markdown)" copy-code />
    <section v-if="content.assetId" class="knowledge-file">
      <span>{{ content.type === 'VIDEO' ? '作品视频原文件' : '相关资料' }}</span>
      <button class="button" @click="download">下载原文件</button>
      <a v-if="downloadUrl" :href="downloadUrl" rel="noopener noreferrer" class="button primary"
        >保存文件</a
      >
    </section>
    <p v-if="!content.markdown && !content.assetId" class="muted">暂未提供正文或文件。</p>
  </div>
</template>
<style scoped>
.knowledge-content {
  min-width: 0;
}
.knowledge-player {
  background: #201f2b;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 28px;
}
.knowledge-player video {
  width: 100%;
  max-height: 560px;
  min-height: 180px;
  object-fit: contain;
  display: block;
}
.video-loading {
  aspect-ratio: 16/9;
  display: flex;
  gap: 16px;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #ded8ed;
  font-size: 14px;
}
.knowledge-content-cover {
  height: auto;
  max-height: 440px;
  overflow: hidden;
  border-radius: 10px;
  margin-bottom: 26px;
  background: #f4f2f8;
}
.knowledge-content-cover :deep(img) {
  height: auto;
  max-height: 440px;
  object-fit: contain;
}
.knowledge-file {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 18px;
  background: #f6f4f9;
  border: 1px solid #e9e4ef;
  border-radius: 8px;
  margin-top: 28px;
  font-size: 13px;
}
.knowledge-file > span {
  flex: 1;
}
.knowledge-content :deep(.reading-prose) {
  font-size: 15px;
  line-height: 1.95;
}
.knowledge-content :deep(pre) {
  overflow-x: auto;
}
.knowledge-content :deep(img) {
  max-width: 100%;
}
@media (max-width: 600px) {
  .knowledge-player video {
    max-height: 360px;
    min-height: 0;
  }
  .knowledge-file {
    padding: 14px;
  }
  .knowledge-content :deep(.reading-prose) {
    font-size: 14px;
  }
}
</style>
