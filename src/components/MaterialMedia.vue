<script setup lang="ts">
import { ref, watch, onBeforeUnmount, defineAsyncComponent } from 'vue';
import { auth, request, errorText } from '../api/client';
import { previewKind, previewBlob } from './material-preview';
const PdfPreview = defineAsyncComponent(() => import('./PdfPreview.vue'));
const props = defineProps<{ id: unknown; mime: string; name: string; expanded?: boolean }>();
const office = () => /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(props.name);
const url = ref(''),
  error = ref(''),
  text = ref('');
let controller: AbortController | undefined;
let generation = 0;
function release() {
  controller?.abort();
  if (url.value.startsWith('blob:')) URL.revokeObjectURL(url.value);
  url.value = '';
}
async function load() {
  const current = ++generation;
  release();
  error.value = '';
  text.value = '';
  const kind = previewKind(props.mime);
  if ((kind === 'file' && (!office() || !props.expanded)) || (!props.expanded && kind === 'text'))
    return;
  controller = new AbortController();
  const signal = controller.signal;
  try {
    if (kind === 'file' && office()) {
      const result = await request<{ pdfBase64: string }>(
        `/${auth.platform}/assets/${props.id}/preview`,
        { method: 'POST' },
      );
      if (current !== generation) return;
      const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
      url.value = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      return;
    }
    const grant = await request<{ url: string }>(`/${auth.platform}/assets/${props.id}/download`, {
      method: 'POST',
    });
    if (current !== generation) return;
    if (!['http:', 'https:'].includes(new URL(grant.url).protocol)) throw new Error('预览地址无效');
    if (kind === 'video') {
      url.value = grant.url;
      return;
    }
    const blob = await previewBlob(grant.url, props.mime, signal);
    if (current !== generation) return;
    if (kind === 'text') text.value = await blob.text();
    else url.value = URL.createObjectURL(blob);
  } catch (e) {
    if (current === generation && !signal.aborted) error.value = errorText(e);
  }
}
function frame(event: Event) {
  const video = event.target as HTMLVideoElement;
  if (!props.expanded && video.duration > 0.1) video.currentTime = 0.1;
}
watch(() => [props.id, props.mime, props.expanded], load, { immediate: true });
onBeforeUnmount(() => {
  generation++;
  release();
});
</script>
<template>
  <div class="media" :class="{ expanded }">
    <img
      v-if="url && previewKind(mime) === 'image'"
      :src="url"
      :alt="name"
      @error="error = '图片无法解码，请下载查看'"
    />
    <video
      v-else-if="url && previewKind(mime) === 'video'"
      :src="url"
      :controls="expanded"
      :muted="!expanded"
      playsinline
      preload="metadata"
      @loadedmetadata="frame"
      @error="error = '视频暂不能播放，可重试或下载'"
    />
    <PdfPreview
      v-else-if="url && (previewKind(mime) === 'pdf' || office())"
      :key="url"
      :url="url"
      :compact="!expanded"
    />
    <pre v-else-if="text">{{ text }}</pre>
    <div v-else class="file-cover">
      <svg viewBox="0 0 48 56" aria-hidden="true">
        <path d="M8 2h22l12 12v38H8z" fill="currentColor" opacity=".12" />
        <path
          d="M30 2v13h12M16 29h18M16 37h14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        /></svg
      ><b>{{ name.split('.').pop()?.toUpperCase().slice(0, 8) || 'FILE' }}</b
      ><span>{{
        previewKind(mime) === 'file'
          ? office()
            ? '点击预览Office文档'
            : '下载查看原文件'
          : ['pdf', 'text'].includes(previewKind(mime)) && !expanded
            ? '点击预览文档'
            : '正在准备预览…'
      }}</span>
    </div>
    <div v-if="error" class="media-error">
      <span>{{ error }}</span
      ><button v-if="expanded" type="button" class="button" @click.stop="load">重新加载</button>
    </div>
  </div>
</template>
<style scoped>
.media {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #f0f5ff, #f6f8fc);
  overflow: hidden;
  display: grid;
  place-items: center;
  color: #7394cb;
}
.media img,
.media video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.expanded img,
.expanded video {
  object-fit: contain;
}
.expanded {
  min-height: 320px;
  height: min(64vh, 650px);
  background: #f3f5f9;
}
.file-cover {
  display: grid;
  justify-items: center;
  gap: 8px;
  font-size: 11px;
}
.file-cover svg {
  width: 45px;
  height: 53px;
}
.file-cover b {
  letter-spacing: 1px;
  font-size: 14px;
}
.media-error {
  position: absolute;
  inset: 0;
  background: #f4f7fc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 18px;
  font-size: 12px;
  text-align: center;
}
iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
pre {
  white-space: pre-wrap;
  overflow: auto;
  width: 100%;
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
  color: #34425c;
}
</style>
