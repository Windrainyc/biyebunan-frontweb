<script setup lang="ts">
import type { Banner } from './banner';
import CompactDialog from './CompactDialog.vue';
import AssetCover from './AssetCover.vue';
import MarkdownContent from './MarkdownContent.vue';
defineProps<{ banner: Banner }>();
defineEmits<{ close: [] }>();
</script>
<template>
  <CompactDialog :title="banner.title" wide @back="$emit('close')"
    ><div class="banner-detail">
      <p v-if="banner.subtitle" class="muted">{{ banner.subtitle }}</p>
      <div v-if="banner.posterAssetId" class="banner-poster">
        <AssetCover :asset-id="banner.posterAssetId" :alt="banner.title" />
      </div>
      <MarkdownContent v-if="banner.body" :text="banner.body" /></div
  ></CompactDialog>
</template>
<style scoped>
.banner-detail {
  padding-bottom: 24px;
  overflow-wrap: anywhere;
}
.banner-poster {
  margin: 0 0 20px;
}
.banner-poster :deep(img) {
  height: auto;
  object-fit: contain;
  border-radius: 8px;
}
</style>
