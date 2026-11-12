<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { request } from '../api/client';
import type { Banner } from './banner';
import AssetCover from './AssetCover.vue';
import BannerDetail from './BannerDetail.vue';
const items = ref<Banner[]>([]),
  index = ref(0),
  detail = ref<Banner | null>(null),
  hidden = ref(false),
  failed = ref(false);
const current = computed(() => items.value[index.value]);
const controller = new AbortController();
async function load() {
  failed.value = false;
  try {
    items.value = await request<Banner[]>('/student/banners', { signal: controller.signal });
    index.value = 0;
  } catch {
    if (!controller.signal.aborted) failed.value = true;
  }
}
onMounted(load);
onBeforeUnmount(() => controller.abort());
</script>
<template>
  <div v-if="failed" class="banner-error">活动暂不可用 <button @click="load">重试</button></div>
  <section v-if="current && !hidden" class="home-banner" aria-label="首页活动">
    <button
      class="banner-open"
      :class="{ 'has-art': current.coverAssetId }"
      :aria-label="'查看活动：' + current.title"
      @click="detail = current"
    >
      <div v-if="current.coverAssetId" class="banner-cover">
        <AssetCover :asset-id="current.coverAssetId" :alt="current.title" />
      </div>
      <template v-else
        ><div class="banner-copy">
          <small>知项 · 精选活动</small><strong>{{ current.title }}</strong
          ><span v-if="current.subtitle">{{ current.subtitle }}</span>
        </div>
        <span class="banner-cta">查看详情 →</span></template
      >
    </button>
    <button class="banner-dismiss" aria-label="关闭首页活动" @click="hidden = true">×</button>
    <div v-if="items.length > 1" class="banner-pages">
      <button
        v-for="(item, i) in items"
        :key="item.id"
        :aria-label="'查看活动 ' + (i + 1)"
        :aria-pressed="i === index"
        :class="{ active: i === index }"
        @click="index = i"
      ></button>
    </div>
  </section>
  <BannerDetail v-if="detail" :banner="detail" @close="detail = null" />
</template>
<style scoped>
.home-banner {
  position: relative;
  border: 1px solid #e3def9;
  background: linear-gradient(105deg, #eeeaff, #f6f4ff 65%, #e9e5ff);
  border-radius: 14px;
  overflow: hidden;
  margin: 0 0 24px;
}
.banner-open {
  width: 100%;
  height: 132px;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  text-align: left;
  padding: 22px 32px;
  gap: 28px;
  color: #302357;
  cursor: pointer;
}
.banner-copy {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 6px;
}
.banner-copy small {
  font-size: 11px;
  letter-spacing: 1px;
  color: #77659e;
}
.banner-copy strong {
  font-size: 22px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.banner-copy span {
  font-size: 13px;
  color: #7a6e95;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.banner-cta {
  font-size: 13px;
  border: 1px solid #d8cff2;
  border-radius: 20px;
  padding: 8px 16px;
  white-space: nowrap;
}
.banner-open.has-art {
  height: auto;
  min-height: 0;
  display: block;
  padding: 0;
}
.banner-cover {
  width: 100%;
  background: #f3ecfb;
}
.banner-cover :deep(img) {
  width: 100%;
  height: auto;
  max-height: 320px;
  object-fit: contain;
  border-radius: 0;
}
.banner-cover :deep(.cover-placeholder) {
  padding: 40px;
  text-align: center;
}
.banner-dismiss {
  position: absolute;
  right: 8px;
  top: 5px;
  border: 0;
  background: #ffffffdf;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  line-height: 24px;
  color: #73648e;
  font-size: 22px;
  padding: 2px 7px;
}
.banner-pages {
  position: absolute;
  bottom: 8px;
  left: 32px;
  display: flex;
  gap: 7px;
}
.banner-pages button {
  width: 7px;
  height: 7px;
  border: 0;
  border-radius: 8px;
  background: #c9c0e5;
  padding: 0;
}
.banner-pages .active {
  width: 22px;
  background: #8571bf;
}
.banner-error {
  font-size: 12px;
  color: #8b7d97;
  margin-bottom: 12px;
}
.banner-error button {
  border: 0;
  background: transparent;
  color: inherit;
  text-decoration: underline;
}
@media (max-width: 600px) {
  .banner-open {
    height: 108px;
    padding: 16px;
    gap: 10px;
  }
  .banner-copy strong {
    font-size: 17px;
  }
  .banner-copy small {
    font-size: 10px;
  }
  .banner-copy span {
    font-size: 12px;
  }
  .banner-cta {
    font-size: 11px;
    padding: 5px 9px;
  }
  .banner-cover :deep(img) {
    max-height: none;
  }
  .banner-pages {
    left: 16px;
    bottom: 5px;
  }
  .home-banner {
    margin-bottom: 16px;
  }
}
</style>
