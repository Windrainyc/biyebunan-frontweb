<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import { auth, request, errorText } from '../api/client';
import type { Row, Page } from '../types/api';
import MaterialMedia from './MaterialMedia.vue';
import CreatePage from './CreatePage.vue';
import { useCreateRoute } from '../composables/useCreateRoute';
const createRoute = useCreateRoute('material');
import MaterialDialog from './MaterialDialog.vue';
import { fileSize } from './material-preview';
import AssetUpload from './AssetUpload.vue';

import AppSelect from './AppSelect.vue';
import { display } from '../config/labels';
const props = defineProps<{ picker?: boolean; kind?: string }>();
const emit = defineEmits<{ selected: [Row] }>();
const categories = ref<Row[]>([]);
const uploadBusy = ref(false);
const preview = ref<Row | null>(null);
const actionError = ref('');
async function loadCategories() {
  try {
    const all: Row[] = [];
    let p = 1;
    while (true) {
      const result = await request<Page<Row>>('/admin/material-categories', {
        query: { page: p++, size: 100 },
      });
      all.push(...result.items);
      if (all.length >= result.total || !result.items.length) break;
    }
    categories.value = all;
  } catch (e) {
    error.value = errorText(e);
  }
}
void loadCategories();
const rows = ref<Row[]>([]),
  total = ref(0),
  page = ref(1),
  query = ref(''),
  category = ref<unknown>(''),
  kind = ref(props.kind || ''),
  error = ref(''),
  loading = ref(false),
  uploadOpen = ref(false),
  uploadCategory = ref<unknown>(''),
  categoryName = ref(''),
  creating = ref(false),
  deleting = ref('');
const writable = computed(
  () =>
    auth.permissions.includes('materials:write') && auth.permissions.includes('post_admin_uploads'),
);
let generation = 0;
onBeforeUnmount(() => {
  generation++;
});
async function load() {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const result = await request<Page<Row>>('/admin/materials', {
      query: {
        page: page.value,
        size: 12,
        q: query.value,
        categoryId: category.value || undefined,
        kind: props.kind || kind.value || undefined,
        state: props.picker ? 'READY' : undefined,
      },
    });
    if (current !== generation) return;
    rows.value = result.items;
    total.value = result.total;
  } catch (e) {
    if (current === generation) {
      error.value = errorText(e);
      rows.value = [];
    }
  } finally {
    if (current === generation) loading.value = false;
  }
}
function search() {
  page.value = 1;
  void load();
}
async function createCategory() {
  if (!categoryName.value.trim() || creating.value) return;
  creating.value = true;
  error.value = '';
  try {
    const c = await request<Row>('/admin/material-categories', {
      method: 'POST',
      body: {
        name: categoryName.value.trim(),
        code: 'MAT_' + crypto.randomUUID().replaceAll('-', ''),
        status: 'ENABLED',
      },
    });
    categories.value.push(c);
    uploadCategory.value = c.id;
    categoryName.value = '';
  } catch (e) {
    error.value = errorText(e);
  } finally {
    creating.value = false;
  }
}
function closeUpload() {
  uploadOpen.value = false;
  if (!props.picker) void createRoute.close();
}
watch(
  createRoute.active,
  (active) => {
    if (!props.picker) uploadOpen.value = active && writable.value;
  },
  { immediate: true },
);
async function uploaded(row: Row) {
  uploadBusy.value = false;
  if (props.kind === 'VIDEO' && !String(row.mimeType).startsWith('video/')) {
    error.value = '文件已保存到素材库，但视频内容请选择视频文件';
    return;
  }
  if (props.kind === 'IMAGE' && !/^image\/(png|jpeg|gif|webp|avif)$/.test(String(row.mimeType))) {
    error.value = '文件已保存到素材库，封面请选择PNG、JPEG、GIF、WebP或AVIF图片';
    return;
  }
  closeUpload();
  await load();
  if (props.picker) emit('selected', row);
}
async function remove(row: Row) {
  if (deleting.value || !confirm(`删除素材“${row.filename}”？已关联的素材不能删除。`)) return;
  deleting.value = String(row.id);
  actionError.value = '';
  try {
    await request(`/admin/assets/${row.id}`, { method: 'DELETE', version: row.version });
    await load();
  } catch (e) {
    const message = errorText(e);
    actionError.value = /引用/.test(message)
      ? '此素材已被内容或历史版本引用，暂不能删除。替换当前关联也不会移除历史版本的引用，请保留原文件。'
      : message;
  } finally {
    deleting.value = '';
  }
}
const download = ref<{ id: string; url: string } | null>(null);
let expiry: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(expiry));
async function prepareDownload(row: Row) {
  error.value = '';
  download.value = null;
  try {
    const g = await request<{ url: string; expiresAt: string }>(
      `/admin/assets/${row.id}/download`,
      { method: 'POST' },
    );
    const u = new URL(g.url);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('下载地址无效');
    download.value = { id: String(row.id), url: g.url };
    clearTimeout(expiry);
    expiry = setTimeout(
      () => {
        download.value = null;
      },
      Math.max(0, Date.parse(g.expiresAt) - Date.now()),
    );
  } catch (e) {
    error.value = errorText(e);
  }
}
watch(
  () => props.kind,
  () => {
    kind.value = props.kind || '';
    search();
  },
  { immediate: true },
);
</script>
<template>
  <section class="material-browser">
    <header v-if="!picker" class="material-heading">
      <div>
        <h1>素材管理</h1>
        <p class="muted">集中管理图片、视频、文档及其他文件，扫描通过后可在知识库中复用。</p>
      </div>
      <RouterLink class="button" to="/admin/material-categories">管理分类</RouterLink>
    </header>
    <div class="material-toolbar">
      <input
        v-model="query"
        aria-label="搜索素材文件名"
        placeholder="搜索文件名"
        @keydown.enter.prevent="search"
      />
      <AppSelect v-if="!props.kind" v-model="kind" aria-label="素材类型"
        ><option value="">全部类型</option>
        <option value="IMAGE">图片</option>
        <option value="VIDEO">视频</option>
        <option value="DOCUMENT">文档</option>
        <option value="OTHER">其他文件</option></AppSelect
      >
      <AppSelect v-model="category" aria-label="筛选素材分类"
        ><option value="">全部分类</option>
        <option v-for="item in categories" :key="String(item.id)" :value="String(item.id)">
          {{ item.name }}
        </option></AppSelect
      >
      <button type="button" class="button primary" :disabled="loading" @click="search">查询</button>
      <button
        type="button"
        class="button"
        @click="
          query = '';
          category = '';
          kind = props.kind || '';
          search();
        "
      >
        重置
      </button>
      <button
        v-if="writable"
        type="button"
        class="button primary"
        @click="
          uploadBusy = false;
          picker ? (uploadOpen = true) : createRoute.open();
        "
      >
        上传素材
      </button>
    </div>
    <component
      :is="picker ? MaterialDialog : CreatePage"
      v-if="uploadOpen"
      title="上传素材"
      :busy="uploadBusy"
      @close="closeUpload"
      @back="closeUpload"
    >
      <p class="muted">把素材收纳到分类，上传后可在知识库中重复使用。</p>
      <label class="category-label"
        >素材分类
        <AppSelect v-model="uploadCategory" :disabled="uploadBusy" aria-label="上传素材分类"
          ><option value="">请选择分类</option>
          <option
            v-for="item in categories.filter((c) => c.status === 'ENABLED')"
            :key="String(item.id)"
            :value="String(item.id)"
          >
            {{ item.name }}
          </option></AppSelect
        >
      </label>
      <details v-if="!uploadBusy" class="new-category">
        <summary>新建分类</summary>
        <div class="material-toolbar">
          <input
            v-model="categoryName"
            maxlength="100"
            aria-label="新素材分类名称"
            placeholder="输入分类名称"
          /><button
            type="button"
            class="button"
            :disabled="creating || !categoryName.trim()"
            @click="createCategory"
          >
            创建并选用
          </button>
        </div>
      </details>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <AssetUpload
        owner-type="MATERIAL"
        :owner-id="String(uploadCategory || '')"
        @ready="uploaded"
        @busy="uploadBusy = $event"
      />
    </component>
    <MaterialDialog
      v-if="preview"
      :title="String(preview.filename)"
      wide
      @close="
        preview = null;
        download = null;
      "
    >
      <MaterialMedia
        :id="preview.id"
        :mime="String(preview.mimeType)"
        :name="String(preview.filename)"
        expanded
      />
      <div class="material-toolbar preview-footer">
        <span class="muted"
          >{{ fileSize(Number(preview.size)) }} · {{ display(preview.state) }}</span
        ><button type="button" class="button" @click="prepareDownload(preview)">获取原文件</button
        ><a
          v-if="download?.id === String(preview.id)"
          class="button primary"
          :href="download.url"
          target="_blank"
          rel="noopener noreferrer"
          >下载文件</a
        >
      </div>
    </MaterialDialog>
    <p v-if="error" class="error" role="alert">
      {{ error }} <button type="button" class="button" @click="load">重试查询</button>
    </p>
    <p v-if="actionError" class="error" role="alert">
      {{ actionError }}
      <button type="button" class="button" @click="actionError = ''">知道了</button>
    </p>
    <p v-if="loading" role="status">正在加载素材…</p>
    <div v-else class="material-grid">
      <article v-for="row in rows" :key="String(row.id)" class="material-card">
        <button
          type="button"
          class="material-preview"
          :disabled="row.state !== 'READY'"
          :aria-label="'预览 ' + row.filename"
          @click="preview = row"
        >
          <MaterialMedia
            v-if="row.state === 'READY'"
            :id="row.id"
            :mime="String(row.mimeType)"
            :name="String(row.filename)"
          /><span v-else>{{ display(row.state) }}</span
          ><span class="preview-hint">点击预览</span>
        </button>
        <div class="material-type">
          {{
            String(row.mimeType).startsWith('image/')
              ? '图片'
              : String(row.mimeType).startsWith('video/')
                ? '视频'
                : '文件'
          }}
        </div>
        <strong :title="String(row.filename)">{{ row.filename }}</strong
        ><small>{{ fileSize(Number(row.size)) }} · {{ display(row.state) }}</small>
        <div class="material-actions">
          <button
            v-if="picker"
            type="button"
            class="button primary"
            :disabled="row.state !== 'READY'"
            @click="emit('selected', row)"
          >
            选择素材</button
          ><button v-if="row.state === 'READY'" type="button" class="button" @click="preview = row">
            预览</button
          ><button
            v-if="!picker && writable && auth.permissions.includes('delete_admin_assets_id')"
            type="button"
            class="button danger"
            :disabled="!!deleting"
            @click="remove(row)"
          >
            删除</button
          ><a
            v-if="download?.id === String(row.id)"
            :href="download.url"
            target="_blank"
            rel="noopener noreferrer"
            >打开文件（短时有效）</a
          >
        </div>
      </article>
      <p v-if="!rows.length" class="muted">
        暂无{{ picker ? '可选的已通过扫描' : '' }}素材，可调整筛选或上传文件。
      </p>
    </div>
    <footer class="material-toolbar">
      <span>共 {{ total }} 个素材 · 第 {{ page }} 页</span
      ><button
        type="button"
        class="button"
        :disabled="page <= 1 || loading"
        @click="
          page--;
          load();
        "
      >
        上一页</button
      ><button
        type="button"
        class="button"
        :disabled="page * 12 >= total || loading"
        @click="
          page++;
          load();
        "
      >
        下一页
      </button>
    </footer>
  </section>
</template>
<style scoped>
.material-preview {
  height: 166px;
  position: relative;
  border: 0;
  padding: 0;
  width: 100%;
  cursor: pointer;
  overflow: hidden;
  border-radius: 8px;
  background: #f2f5fb;
}
.material-browser {
  min-width: 0;
}
.material-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.material-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 14px 0;
}
.material-toolbar > input {
  flex: 1;
  min-width: 160px;
}
.material-toolbar > :deep(.app-select) {
  min-width: 140px;
}
.material-filter {
  margin: 14px 0;
}
.material-filter summary {
  cursor: pointer;
  color: #53668c;
  margin-bottom: 12px;
}
.material-upload {
  padding: 14px;
  border: 1px solid #dbe3f2;
  border-radius: 12px;
  background: #f8faff;
  margin-bottom: 16px;
}
.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(245px, 100%), 1fr));
  gap: 14px;
}
.material-card {
  padding: 14px;
  border: 1px solid #e2e7f1;
  border-radius: 12px;
  background: white;
  display: grid;
  gap: 10px;
  min-width: 0;
}
.material-card strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.material-card small {
  color: #77829a;
}
.material-type {
  font-size: 12px;
  color: #5d68aa;
}
.material-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
footer {
  justify-content: flex-end;
}
.preview-hint {
  position: absolute;
  bottom: 10px;
  right: 10px;
  padding: 5px 9px;
  border-radius: 6px;
  color: #46638e;
  background: #ffffffde;
  font-size: 11px;
  opacity: 0;
  transition: opacity 0.15s;
}
.material-preview:hover .preview-hint,
.material-preview:focus-visible .preview-hint {
  opacity: 1;
}
.material-card {
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
}
.material-card:hover {
  border-color: #bdd1ed;
  box-shadow: 0 6px 20px #3a59900b;
}
.category-label {
  display: grid;
  gap: 9px;
  margin: 20px 0 12px;
  font-size: 13px;
}
.new-category {
  margin-bottom: 20px;
  color: #6889b8;
  font-size: 12px;
}
.new-category summary {
  cursor: pointer;
}
.preview-footer {
  justify-content: flex-end;
}
.preview-footer span {
  margin-right: auto;
}
.material-type {
  margin-top: 3px;
}
.material-actions {
  border-top: 1px solid #f0f3f8;
  padding-top: 12px;
}
.material-toolbar > input {
  max-width: 320px;
}
.material-toolbar > :deep(.app-select) {
  max-width: 200px;
}
.material-dialog h2 {
  overflow-wrap: anywhere;
}
@media (prefers-reduced-motion: reduce) {
  .material-card,
  .preview-hint {
    transition: none;
  }
}
</style>
