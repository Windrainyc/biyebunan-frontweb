<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { auth, request } from '../api/client';
const props = defineProps<{ assetId: unknown; alt?: string }>();
const url = ref(''),
  failed = ref(false);
let generation = 0;
watch(
  () => [props.assetId, auth.platform],
  async () => {
    const current = ++generation;
    url.value = '';
    failed.value = false;
    if (!props.assetId) return;
    try {
      const grant = await request<{ url: string }>(
        `/${auth.platform}/assets/${props.assetId}/download`,
        { method: 'POST' },
      );
      if (current !== generation) return;
      const parsed = new URL(grant.url);
      if (['http:', 'https:'].includes(parsed.protocol)) url.value = grant.url;
    } catch {
      if (current === generation) failed.value = true;
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
  url.value = '';
});
</script>
<template>
  <img
    v-if="url && !failed"
    :src="url"
    :alt="alt || '内容封面'"
    loading="lazy"
    @error="failed = true"
  /><span v-else class="cover-placeholder">{{ failed ? '封面暂不可用' : '内容封面' }}</span>
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
