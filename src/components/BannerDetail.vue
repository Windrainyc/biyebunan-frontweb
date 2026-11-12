<script setup lang="ts">
import type { Banner } from './banner';
import AssetCover from './AssetCover.vue';
import MarkdownContent from './MarkdownContent.vue';
import Icon from './Icon.vue';
defineProps<{ banner: Banner }>();
const emit = defineEmits<{ close: [] }>();
</script>
<template>
  <Teleport to="body"
    ><div class="promotion-overlay" @click.self="emit('close')">
      <section
        v-dialog="() => emit('close')"
        class="promotion-dialog"
        :class="{
          'with-poster': banner.posterAssetId,
          'poster-only': banner.posterAssetId && !banner.body?.trim(),
        }"
        role="dialog"
        aria-modal="true"
        :aria-label="banner.title"
      >
        <header class="promotion-heading">
          <span>知项 · 活动详情</span
          ><button type="button" aria-label="关闭活动详情" @click="emit('close')">
            <Icon name="close" />
          </button>
        </header>
        <div class="promotion-content">
          <div v-if="banner.posterAssetId" class="promotion-poster">
            <AssetCover :asset-id="banner.posterAssetId" :alt="banner.title" />
          </div>
          <div v-if="!banner.posterAssetId || banner.body?.trim()" class="promotion-copy">
            <p class="promotion-eyebrow">精选活动</p>
            <h2>{{ banner.title }}</h2>
            <p v-if="banner.subtitle" class="promotion-subtitle">{{ banner.subtitle }}</p>
            <MarkdownContent v-if="banner.body" :text="banner.body" />
          </div>
        </div>
      </section></div
  ></Teleport>
</template>
<style scoped>
.promotion-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: #2220398c;
  backdrop-filter: blur(7px);
}
.promotion-dialog {
  width: min(620px, 100%);
  max-height: calc(100dvh - 48px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border: 1px solid #ffffff80;
  border-radius: 20px;
  box-shadow: 0 24px 90px #100d304d;
  color: #29263f;
}
.promotion-dialog.with-poster {
  width: min(960px, 100%);
}
.promotion-dialog.poster-only {
  width: fit-content;
  max-width: 100%;
}
.promotion-heading {
  height: 58px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 36px;
  padding: 0 20px 0 24px;
  border-bottom: 1px solid #eeedf4;
  background: #fff;
}
.promotion-heading span {
  font-size: 13px;
  letter-spacing: 1px;
  color: #8b839b;
}
.promotion-heading button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 7px;
  border: 0;
  border-radius: 50%;
  background: #f3f1f8;
  color: #716584;
  cursor: pointer;
}
.promotion-content {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  display: flex;
  align-items: stretch;
}
.promotion-poster {
  flex: 0 1 52%;
  min-width: 0;
  background: #f3eff9;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}
.promotion-poster :deep(img) {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: calc(100dvh - 150px);
  object-fit: contain;
  border-radius: 10px;
  box-shadow: 0 8px 28px #4d37631a;
}
.poster-only .promotion-poster {
  flex: auto;
}
.promotion-copy {
  flex: 1;
  min-width: 0;
  padding: 32px;
  overflow-wrap: anywhere;
}
.promotion-eyebrow {
  font-size: 11px;
  letter-spacing: 2px;
  color: #9688ae;
  margin: 0 0 12px;
}
.promotion-copy h2 {
  font-size: 25px;
  line-height: 1.4;
  margin: 0 0 14px;
  color: #332449;
}
.promotion-subtitle {
  font-size: 14px;
  line-height: 1.8;
  color: #8a8094;
  margin: 0 0 24px;
}
.promotion-copy :deep(.reading-prose) {
  font-size: 14px;
  line-height: 1.9;
}
@media (max-width: 640px) {
  .promotion-overlay {
    padding: 12px;
  }
  .promotion-dialog {
    max-height: calc(100dvh - 24px);
    border-radius: 16px;
  }
  .promotion-heading {
    height: 48px;
    padding: 0 12px 0 18px;
  }
  .promotion-content {
    display: block;
  }
  .promotion-poster {
    padding: 12px;
  }
  .promotion-poster :deep(img) {
    max-height: calc(100dvh - 100px);
  }
  .promotion-copy {
    padding: 22px;
  }
  .promotion-copy h2 {
    font-size: 21px;
  }
  .promotion-dialog.poster-only {
    width: 100%;
  }
}
</style>
