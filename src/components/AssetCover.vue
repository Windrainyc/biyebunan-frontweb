<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { previewBlob, previewKind } from './material-preview';
import { ApiError, auth, request } from '../api/client';
import { loadCover } from './cover-loader';
const props = defineProps<{ assetId: unknown; alt?: string; width?: 240 | 800 | 1600 }>();
const placeholder = ref<HTMLElement>();
const visible = ref(false);
let observer: IntersectionObserver | undefined;
onMounted(() => {
  if (!('IntersectionObserver' in window)) {
    visible.value = true;
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        visible.value = true;
        observer?.disconnect();
      }
    },
    { rootMargin: '120px' },
  );
  if (placeholder.value) observer.observe(placeholder.value);
});
const url = ref(''),
  failed = ref(false);
let generation = 0;
let controller: AbortController | undefined;
function clear() {
  controller?.abort();
  if (url.value.startsWith('blob:')) URL.revokeObjectURL(url.value);
  url.value = '';
}
watch(
  () => [props.assetId, props.width, auth.platform, auth.user?.id, visible.value],
  async () => {
    const current = ++generation;
    clear();
    controller = new AbortController();
    const signal = controller.signal;
    failed.value = false;
    if (!props.assetId || !visible.value) return;
    try {
      if (props.width) {
        try {
          const blob = await loadCover(String(props.assetId), props.width);
          if (current === generation) url.value = URL.createObjectURL(blob);
          return;
        } catch (error) {
          // AVIF等OSS暂不支持的格式仍按固定版本读取原图；权限及版本错误不能降级绕过。
          if (!(error instanceof ApiError) || error.problem.code !== 'THUMBNAIL_UNSUPPORTED')
            throw error;
        }
      }
      const asset = await request<{ mimeType: string }>(
        `/${auth.platform}/assets/${props.assetId}`,
      );
      if (previewKind(asset.mimeType) !== 'image') throw new Error('不支持的封面');
      const grant = await request<{ url: string }>(
        `/${auth.platform}/assets/${props.assetId}/download`,
        { method: 'POST' },
      );
      if (current !== generation) return;
      const parsed = new URL(grant.url);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        const blob = await previewBlob(grant.url, asset.mimeType, signal);
        if (current === generation) url.value = URL.createObjectURL(blob);
      }
    } catch {
      if (current === generation) failed.value = true;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
  observer?.disconnect();
  clear();
});
</script>
<template>
  <img
    v-if="url && !failed"
    :src="url"
    :alt="alt || '内容封面'"
    loading="lazy"
    @error="failed = true"
  /><span v-else ref="placeholder" class="cover-placeholder">{{
    failed ? '封面暂不可用' : '内容封面'
  }}</span>
</template>
<style scoped>
img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: inherit;
}
.cover-placeholder {
  font-size: 13px;
  color: #6c78a2;
  padding: 16px;
  display: block;
}
</style>
