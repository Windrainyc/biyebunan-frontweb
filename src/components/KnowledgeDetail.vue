<script setup lang="ts">
import { watch, onBeforeUnmount, ref } from 'vue';
import { auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import type { Row, Page } from '../types/api';
import { display } from '../config/labels';
import AssetUpload from './AssetUpload.vue';
const props = defineProps<{ content: Row }>(),
  emit = defineEmits<{ changed: [] }>();
const items = ref<Row[]>([]),
  page = ref(1),
  total = ref(0),
  error = ref(''),
  video = ref(''),
  busy = ref(false);
const attempt = writeAttempt();
const loading = ref(false),
  downloadUrl = ref('');
let generation = 0,
  downloadGeneration = 0;
let downloadTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => {
  generation++;
  downloadGeneration++;
  clearTimeout(downloadTimer);
});
async function load() {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const data = await request<Page<Row>>(
      `/${auth.platform}/knowledge/${props.content.id}/versions`,
      { query: { page: page.value, size: 20 } },
    );
    if (current !== generation) return;
    items.value = data.items;
    total.value = data.total;
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) loading.value = false;
  }
}
async function attach(asset: Row) {
  busy.value = true;
  try {
    const c = await request<Row>(`/admin/knowledge/${props.content.id}`);
    const body = {
      title: c.title,
      categoryId: c.categoryId,
      tagIds: c.tagIds,
      type: c.type,
      assetId: asset.id,
      markdown: c.markdown || '',
      audience: c.audience,
      projectId: c.projectId || null,
    };
    await request(`/admin/knowledge/${props.content.id}`, {
      method: 'PUT',
      body,
      version: c.version,
      key: attempt(body),
    });
    emit('changed');
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function download(asset: unknown, play = false) {
  const current = ++downloadGeneration;
  downloadUrl.value = '';
  clearTimeout(downloadTimer);
  try {
    const grant = await request<{ url: string; expiresAt: string }>(
      `/${auth.platform}/assets/${asset}/download`,
      {
        method: 'POST',
        query: play ? { variant: 'PLAYBACK' } : {},
      },
    );
    const url = new URL(grant.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('文件地址无效');
    if (current !== downloadGeneration) return;
    const remaining = Date.parse(grant.expiresAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0)
      throw new Error('文件授权已过期，请重新获取');
    if (play) video.value = url.toString();
    else {
      downloadUrl.value = url.toString();
      downloadTimer = setTimeout(() => {
        downloadUrl.value = '';
      }, remaining);
    }
  } catch (e) {
    error.value = errorText(e);
  }
}
watch(
  () => [props.content.id, props.content.version],
  () => {
    page.value = 1;
    load();
  },
  { immediate: true },
);
</script>
<template>
  <section>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="content.markdown" class="prose">{{ content.markdown }}</p>
    <template v-if="content.assetId"
      ><button class="button" @click="download(content.assetId)">下载资料</button
      ><button
        v-if="content.type === 'VIDEO'"
        class="button"
        @click="download(content.assetId, true)"
      >
        播放视频
      </button></template
    ><video
      v-if="video"
      :src="video"
      controls
      preload="metadata"
      style="width: 100%; margin-top: 16px"
    />
    <p v-if="downloadUrl">
      <a :href="downloadUrl" rel="noopener noreferrer" class="button">保存已授权资料</a>
    </p>
    <h3>内容版本</h3>
    <article v-for="item in items" :key="String(item.id)" class="version">
      <strong>第{{ item.versionNumber }}版 · {{ display(item.state) }}</strong
      ><span>{{ display(item.createdAt) }}</span>
      <p v-if="item.markdown" class="prose">{{ item.markdown }}</p>
      <button v-if="item.assetId" class="button" @click="download(item.assetId)">
        下载版本文件
      </button>
    </article>
    <p v-if="!items.length" class="muted">暂无已发布版本</p>
    <div class="pagination">
      <button
        class="button"
        :disabled="loading || page === 1"
        @click="
          page--;
          load();
        "
      >
        上一页</button
      ><span>第{{ page }}页 · 共{{ total }}条</span
      ><button
        class="button"
        :disabled="loading || page * 20 >= total"
        @click="
          page++;
          load();
        "
      >
        下一页
      </button>
    </div>
    <template
      v-if="
        auth.platform === 'admin' && content.state !== 'PUBLISHED' && content.type !== 'MARKDOWN'
      "
      ><h3>上传内容文件</h3>
      <AssetUpload owner-type="KNOWLEDGE" :owner-id="String(content.id)" @ready="attach"
    /></template>
  </section>
</template>
<style scoped>
.version {
  padding: 18px;
  border: 1px solid #e2e6ef;
  border-radius: 10px;
  margin-bottom: 12px;
  font-size: 13px;
}
.version span {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: #748096;
}
button {
  margin-right: 8px;
}
</style>
