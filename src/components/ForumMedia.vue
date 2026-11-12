<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { request, auth, errorText } from '../api/client';
import { previewBlob } from './material-preview';
const props = defineProps<{ id: string }>();
const url = ref(''),
  name = ref('正文文件'),
  downloadUrl = ref(''),
  kind = ref(''),
  error = ref(''),
  busy = ref(false);
const controller = new AbortController();
let disposed = false;
async function open() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const asset = await request<{ filename: string; mimeType: string }>(
      `/${auth.platform}/assets/${props.id}`,
    );
    const grant = await request<{ url: string }>(`/${auth.platform}/assets/${props.id}/download`, {
      method: 'POST',
    });
    name.value = asset.filename;
    kind.value =
      /^(image\/(png|jpeg|webp|gif|avif)|video\/(mp4|webm|ogg)|audio\/(mpeg|mp4|ogg|wav|webm))$/.test(
        asset.mimeType,
      )
        ? asset.mimeType.split('/')[0]!
        : 'file';
    const parsed = new URL(grant.url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw Error('文件地址无效');
    downloadUrl.value = parsed.href;
    if (url.value.startsWith('blob:')) URL.revokeObjectURL(url.value);
    if (kind.value === 'file') {
      url.value = parsed.href;
    } else {
      const blob = await previewBlob(parsed.href, asset.mimeType, controller.signal);
      if (!disposed) url.value = URL.createObjectURL(blob);
    }
  } catch (e) {
    if (!disposed) error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => {
  disposed = true;
  controller.abort();
  if (url.value.startsWith('blob:')) URL.revokeObjectURL(url.value);
});
</script>
<template>
  <figure class="forum-media">
    <button v-if="!url" type="button" class="button" :disabled="busy" @click="open">
      {{ busy ? '正在加载…' : '打开正文媒体 / 文件' }}
    </button>
    <img v-else-if="kind === 'image'" :src="url" :alt="name" />
    <video v-else-if="kind === 'video'" :src="url" controls preload="metadata" />
    <audio v-else-if="kind === 'audio'" :src="url" controls preload="metadata" />
    <a v-else :href="url" target="_blank" rel="noopener noreferrer">下载 {{ name }}</a>
    <figcaption v-if="url">{{ name }}</figcaption>
    <p v-if="error" class="error">{{ error }}</p>
    <a v-if="downloadUrl && error" :href="downloadUrl" target="_blank" rel="noopener noreferrer">下载原文件</a>
    <button v-if="url" type="button" class="button" :disabled="busy" @click="open">刷新访问</button>
  </figure>
</template>
<style scoped>
.forum-media {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid #e7e3f0;
  border-radius: 12px;
  max-width: 100%;
}
.forum-media img,
.forum-media video {
  max-width: 100%;
  max-height: 540px;
  display: block;
}
.forum-media audio {
  max-width: 100%;
}
figcaption {
  font-size: 12px;
  color: #858097;
  margin-top: 8px;
}
</style>
