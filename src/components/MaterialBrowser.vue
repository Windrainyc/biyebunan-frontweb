<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import { auth, request, errorText } from '../api/client';
import type { Row, Page } from '../types/api';
import AssetCover from './AssetCover.vue';
import AssetUpload from './AssetUpload.vue';
import ReferenceField from './ReferenceField.vue';
import AppSelect from './AppSelect.vue';
import { display } from '../config/labels';
const props = defineProps<{ picker?: boolean; kind?: string }>();
const emit = defineEmits<{ selected: [Row] }>();
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
    uploadCategory.value = c.id;
    categoryName.value = '';
  } catch (e) {
    error.value = errorText(e);
  } finally {
    creating.value = false;
  }
}
async function uploaded(row: Row) {
  if (props.kind === 'VIDEO' && !String(row.mimeType).startsWith('video/')) {
    error.value = '文件已保存到素材库，但视频内容请选择视频文件';
    return;
  }
  if (props.kind === 'IMAGE' && !/^image\/(png|jpeg|gif|webp|avif)$/.test(String(row.mimeType))) {
    error.value = '文件已保存到素材库，封面请选择PNG、JPEG、GIF、WebP或AVIF图片';
    return;
  }
  await load();
  if (props.picker) emit('selected', row);
}
async function remove(row: Row) {
  if (deleting.value || !confirm(`删除素材“${row.filename}”？已关联的素材不能删除。`)) return;
  deleting.value = String(row.id);
  error.value = '';
  try {
    await request(`/admin/assets/${row.id}`, { method: 'DELETE', version: row.version });
    await load();
  } catch (e) {
    error.value = errorText(e);
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
        @click="uploadOpen = !uploadOpen"
      >
        {{ uploadOpen ? '收起上传' : '本地上传' }}
      </button>
    </div>
    <details class="material-filter">
      <summary>按素材分类筛选</summary>
      <ReferenceField v-model="category" field="materialCategoryId" /><button
        type="button"
        class="button"
        @click="search"
      >
        应用分类
      </button>
    </details>
    <div v-if="uploadOpen" class="material-upload">
      <h3>上传到素材库</h3>
      <p class="muted">选择分类后上传，单文件不超过2GB；文件不会自动公开。</p>
      <ReferenceField
        v-model="uploadCategory"
        field="materialCategoryId"
        :filters="{ status: 'ENABLED' }"
      />
      <div class="material-toolbar">
        <input
          v-model="categoryName"
          maxlength="100"
          aria-label="新素材分类名称"
          placeholder="也可在此新建素材分类"
        /><button
          type="button"
          class="button"
          :disabled="creating || !categoryName.trim()"
          @click="createCategory"
        >
          新建分类并选用
        </button>
      </div>
      <AssetUpload
        v-if="uploadCategory"
        :key="String(uploadCategory)"
        owner-type="MATERIAL"
        :owner-id="String(uploadCategory)"
        @ready="uploaded"
      />
    </div>
    <p v-if="error" class="error" role="alert">
      {{ error }} <button type="button" class="button" @click="load">重试查询</button>
    </p>
    <p v-if="loading" role="status">正在加载素材…</p>
    <div v-else class="material-grid">
      <article v-for="row in rows" :key="String(row.id)" class="material-card">
        <div
          v-if="
            row.state === 'READY' && /^image\/(png|jpeg|gif|webp|avif)$/.test(String(row.mimeType))
          "
          class="material-preview"
        >
          <AssetCover :asset-id="row.id" :alt="String(row.filename)" />
        </div>
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
        ><small>{{ (Number(row.size) / 1024).toFixed(1) }} KB · {{ display(row.state) }}</small>
        <div class="material-actions">
          <button
            v-if="picker"
            type="button"
            class="button primary"
            :disabled="row.state !== 'READY'"
            @click="emit('selected', row)"
          >
            选择素材</button
          ><button
            v-if="row.state === 'READY'"
            type="button"
            class="button"
            @click="prepareDownload(row)"
          >
            预览 / 下载</button
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
  height: 130px;
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
  padding: 18px;
  border: 1px solid #dbe3f2;
  border-radius: 12px;
  background: #f8faff;
  margin-bottom: 16px;
}
.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(235px, 100%), 1fr));
  gap: 14px;
}
.material-card {
  padding: 18px;
  border: 1px solid #e2e7f1;
  border-radius: 12px;
  background: white;
  display: grid;
  gap: 10px;
  min-width: 0;
}
.material-card strong {
  overflow-wrap: anywhere;
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
</style>
