<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import type { Page, Row } from '../types/api';
import AssetCover from '../components/AssetCover.vue';
import ReferenceName from '../components/ReferenceName.vue';
import ReferenceField from '../components/ReferenceField.vue';
import KnowledgeCategoryNav from '../components/KnowledgeCategoryNav.vue';
import KnowledgeEditor from '../components/KnowledgeEditor.vue';
import KnowledgeDetail from '../components/KnowledgeDetail.vue';
import MaterialField from '../components/MaterialField.vue';
import ContentOutline from '../components/ContentOutline.vue';
import CompactDialog from '../components/CompactDialog.vue';
import AppSelect from '../components/AppSelect.vue';
import KnowledgeTags from '../components/KnowledgeTags.vue';
const tagsPending = ref(false);
import { display } from '../config/labels';
const route = useRoute(),
  router = useRouter(),
  admin = computed(() => auth.platform === 'admin');
const endpoint = computed(() => `/${auth.platform}/knowledge`);
const base = computed(() => (admin.value ? '/admin/contents' : '/student/knowledge'));
const rows = ref<Row[]>([]),
  total = ref(0),
  loading = ref(false),
  busy = ref(false),
  error = ref('');
const q = ref(''),
  category = ref<unknown>(''),
  status = ref(''),
  page = ref(1),
  size = ref(12);
const detail = ref<Row | null>(null),
  editing = ref(false),
  preview = ref(false),
  media = ref(false);
const formElement = ref<HTMLFormElement>();
const blank = (): Row => ({
  title: '',
  categoryId: '',
  tagIds: [],
  type: 'MARKDOWN',
  assetId: null,
  coverAssetId: null,
  markdown: '',
  audience: 'PUBLIC',
  projectId: null,
  state: 'DRAFT',
});
const form = ref<Row>(blank()),
  baseline = ref('');
const dirty = computed(() => editing.value && JSON.stringify(form.value) !== baseline.value);
const attempt = writeAttempt();
const can = (p: string) => admin.value && auth.permissions.includes(p);
const canSave = computed(() =>
  can(form.value.id ? 'put_admin_knowledge_id' : 'post_admin_knowledge'),
);
const canPublish = computed(() => can('post_admin_knowledge_id_publish'));
let generation = 0,
  disposed = false,
  leaving = false;
const action = ref<{ row: Row; kind: 'publish' | 'withdraw' | 'delete' } | null>(null);
const name = (s: unknown) =>
  ({ DRAFT: '草稿', REVIEW: '待发布', PUBLISHED: '已发布', WITHDRAWN: '已下架' })[String(s)] ||
  String(s);
const excerpt = (row: Row) =>
  String(row.markdown || '')
    .replace(/[#*`>\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload));
onBeforeUnmount(() => {
  disposed = true;
  generation++;
  window.removeEventListener('beforeunload', beforeUnload);
});
onBeforeRouteLeave(
  () => !busy.value && (leaving || !dirty.value || confirm('有未保存的内容，确定离开？')),
);
async function load() {
  const n = ++generation;
  loading.value = true;
  error.value = '';
  rows.value = [];
  try {
    const data = await request<Page<Row>>(endpoint.value, {
      query: {
        page: page.value,
        size: size.value,
        q: q.value,
        categoryId: category.value,
        status: admin.value ? status.value : '',
      },
    });
    if (n === generation && !disposed) {
      rows.value = data.items;
      total.value = data.total;
    }
  } catch (e) {
    if (n === generation) error.value = errorText(e);
  } finally {
    if (n === generation) loading.value = false;
  }
}
function listQuery() {
  return {
    q: q.value || undefined,
    categoryId: String(category.value || '') || undefined,
    status: status.value || undefined,
    page: String(page.value),
    size: String(size.value),
  };
}
function search() {
  page.value = 1;
  void router.replace({ path: base.value, query: listQuery() });
}
function reset() {
  q.value = '';
  category.value = '';
  status.value = '';
  search();
}
async function open(row: Row, edit = false) {
  if (busy.value) return;
  if (dirty.value && !confirm('有未保存的内容，确定离开？')) return;
  await router.push({
    path: base.value,
    query: { ...listQuery(), [edit ? 'edit' : 'view']: String(row.id) },
  });
}
function create() {
  void router.push({ path: base.value + '/new', query: listQuery() });
}
function back() {
  if (busy.value) return;
  if (dirty.value && !confirm('有未保存的内容，确定返回？')) return;
  editing.value = false;
  preview.value = false;
  void router.push({ path: base.value, query: listQuery() });
}
async function location() {
  const n = ++generation;
  error.value = '';
  detail.value = null;
  editing.value = false;
  preview.value = false;
  loading.value = true;
  q.value = String(route.query.q || '');
  category.value = String(route.query.categoryId || '');
  status.value = String(route.query.status || '');
  page.value = Math.max(1, Number(route.query.page) || 1);
  size.value = [12, 24, 48].includes(Number(route.query.size)) ? Number(route.query.size) : 12;
  try {
    const id = route.query.edit || route.query.view;
    if (route.params.action === 'new' && admin.value) {
      form.value = blank();
      baseline.value = JSON.stringify(form.value);
      editing.value = true;
      media.value = false;
    } else if (id) {
      const row = await request<Row>(endpoint.value + '/' + String(id));
      if (n !== generation || disposed) return;
      if (route.query.edit && admin.value) {
        form.value = { ...row, markdown: row.markdown || '', tagIds: row.tagIds || [] };
        baseline.value = JSON.stringify(form.value);
        media.value = !!row.assetId;
        editing.value = true;
      } else detail.value = row;
    } else {
      await load();
      return;
    }
  } catch (e) {
    if (n === generation) error.value = errorText(e);
  } finally {
    if (n === generation) loading.value = false;
  }
}
watch(() => route.fullPath, location, { immediate: true });
async function mediaChanged(id: unknown) {
  form.value.assetId = id || null;
  if (!id) {
    form.value.type = 'MARKDOWN';
    return;
  }
  try {
    const asset = await request<Row>('/admin/assets/' + String(id));
    if (form.value.assetId === id)
      form.value.type = String(asset.mimeType).startsWith('video/') ? 'VIDEO' : 'DOCUMENT';
  } catch (e) {
    error.value = errorText(e);
  }
}
async function save(publish: boolean) {
  if (busy.value || tagsPending.value || !formElement.value?.reportValidity()) return;
  if (!form.value.categoryId) {
    error.value = '请选择分类';
    return;
  }
  if (publish && !form.value.assetId && !String(form.value.markdown || '').trim()) {
    error.value = '请填写正文或选择视频 / 文件';
    return;
  }
  if (publish && !confirm('确认发布这篇内容？有权限的学生将看到本次内容。')) return;
  busy.value = true;
  error.value = '';
  try {
    const f = form.value;
    const body = {
      title: String(f.title).trim(),
      categoryId: f.categoryId,
      tagIds: f.tagIds || [],
      type: f.assetId ? f.type : 'MARKDOWN',
      assetId: f.assetId || null,
      coverAssetId: f.coverAssetId || null,
      markdown: f.markdown || '',
      audience: f.audience,
      projectId: f.audience === 'PROJECT' ? f.projectId : null,
    };
    await request(endpoint.value + (f.id ? '/' + f.id : ''), {
      method: f.id ? 'PUT' : 'POST',
      query: { publish },
      version: f.id ? f.version : undefined,
      body,
      key: attempt({ id: f.id, version: f.version, publish, body }),
    });
    editing.value = false;
    leaving = true;
    await router.push({ path: base.value, query: listQuery() });
    leaving = false;
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function act() {
  if (!action.value || busy.value) return;
  const { row, kind } = action.value;
  busy.value = true;
  error.value = '';
  try {
    await request(endpoint.value + '/' + row.id + (kind === 'delete' ? '' : '/' + kind), {
      method: kind === 'delete' ? 'DELETE' : 'POST',
      version: row.version,
      body:
        kind === 'delete'
          ? undefined
          : { reason: kind === 'publish' ? '管理员直接发布' : '管理员下架' },
      key: attempt({ id: row.id, version: row.version, kind }),
    });
    action.value = null;
    if (rows.value.length === 1 && page.value > 1) page.value--;
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="knowledge-library" :class="{ 'is-admin': admin }">
    <p v-if="error" class="error" role="alert">
      {{ error }} <button v-if="!editing" class="text-button" @click="location">重新加载</button>
    </p>
    <p v-if="loading" class="muted" role="status">正在加载知识内容…</p>
    <template v-if="detail || preview">
      <button class="text-button kb-back" @click="preview ? (preview = false) : back()">
        {{ preview ? '返回编辑' : '返回知识库' }}
      </button>
      <div class="kb-reading-layout reading-page">
        <article class="kb-article">
          <header class="kb-article-heading">
            <div class="kb-category">
              <ReferenceName field="categoryId" :value="(preview ? form : detail)?.categoryId" />
            </div>
            <h1>{{ (preview ? form : detail)?.title }}</h1>
            <p class="kb-meta">
              {{ preview ? '内容预览' : '更新于 ' + display(detail?.updatedAt) }}
            </p>
          </header>
          <div class="kb-article-body">
            <KnowledgeDetail
              :key="String((preview ? form : detail)?.id || 'preview')"
              :content="(preview ? form : detail)!"
              readonly
            />
          </div>
        </article>
        <aside class="kb-outline">
          <ContentOutline :text="String((preview ? form : detail)?.markdown || '')" /><RouterLink
            v-if="!admin"
            class="button"
            :to="{
              path: '/student/chat',
              query:
                detail?.publishedVersionId && detail?.indexState === 'READY'
                  ? { source: String(detail.publishedVersionId), title: String(detail.title) }
                  : {},
            }"
            >围绕这篇内容提问</RouterLink
          >
        </aside>
      </div>
    </template>
    <form v-else-if="editing" ref="formElement" @submit.prevent="save(form.state === 'PUBLISHED')">
      <button type="button" class="text-button kb-back" :disabled="busy" @click="back">
        返回知识库
      </button>
      <header class="kb-heading">
        <h1>{{ form.id ? '编辑内容' : '新增内容' }}</h1>
        <span class="kb-badge" :class="{ live: form.state === 'PUBLISHED' }">{{
          name(form.state)
        }}</span>
      </header>
      <div class="kb-editor-layout">
        <section class="kb-editor-main">
          <input
            v-model="form.title"
            class="kb-title-input"
            aria-label="内容标题"
            placeholder="输入内容标题"
            required
            maxlength="200"
          />
          <div class="kb-media-toolbar">
            <button type="button" class="button" @click="media = !media">
              {{ media ? '收起视频 / 文件' : '添加视频 / 文件' }}</button
            ><span>正文支持 Markdown 排版</span>
          </div>
          <div v-if="media" class="kb-main-media">
            <label>正文开头的视频 / 文件</label
            ><MaterialField :model-value="form.assetId" @update:model-value="mediaChanged" />
          </div>
          <KnowledgeEditor v-model="form.markdown" :max-length="200000" label="正文" />
        </section>
        <aside class="kb-settings">
          <label>封面</label>
          <div v-if="form.coverAssetId" class="kb-editor-cover">
            <AssetCover :width="800" :asset-id="form.coverAssetId" alt="内容封面预览" />
          </div>
          <MaterialField v-model="form.coverAssetId" kind="image" />
          <p class="muted">封面按原比例完整展示，不裁切。</p>
          <label
            >分类
            <ReferenceField v-model="form.categoryId" field="categoryId" required dropdown /></label
          ><label
            >可见范围
            <AppSelect v-model="form.audience" aria-label="可见范围"
              ><option value="PUBLIC">全部学生</option>
              <option value="MEMBER">有效会员</option>
              <option value="PROJECT">指定项目学生</option></AppSelect
            ></label
          ><label v-if="form.audience === 'PROJECT'"
            >所属项目
            <ReferenceField v-model="form.projectId" field="projectId" required dropdown /></label
          ><label
            >内容标签
            <KnowledgeTags v-model="form.tagIds" :disabled="busy" @pending="tagsPending = $event"
          /></label>
        </aside>
      </div>
      <footer class="kb-savebar">
        <span>{{
          form.state === 'PUBLISHED'
            ? '更新发布后生效，保存失败保留原内容。'
            : '草稿仅管理员可见；发布后学生可见。'
        }}</span>
        <div>
          <button type="button" class="button" :disabled="busy" @click="preview = true">预览</button
          ><button
            v-if="canSave && form.state !== 'PUBLISHED'"
            type="submit"
            class="button"
            :disabled="busy || tagsPending"
          >
            保存草稿</button
          ><button
            v-if="canSave && canPublish"
            type="button"
            class="button primary"
            :disabled="busy || tagsPending"
            @click="save(true)"
          >
            {{ busy ? '保存中…' : form.state === 'PUBLISHED' ? '更新发布' : '发布' }}
          </button>
        </div>
      </footer>
    </form>
    <template v-else-if="!loading">
      <header class="kb-heading">
        <div>
          <h1>知识库</h1>
          <p>{{ admin ? '管理内容、封面和发布状态' : '找到思路，也看见作品。' }}</p>
        </div>
        <button v-if="admin && can('post_admin_knowledge')" class="button primary" @click="create">
          新增内容
        </button>
        <form v-else class="kb-search" @submit.prevent="search">
          <input v-model="q" placeholder="搜索作品、知识或关键词" aria-label="搜索知识" /><button
            class="button"
            type="submit"
          >
            搜索
          </button>
        </form>
      </header>
      <div v-if="!admin" class="kb-categories">
        <KnowledgeCategoryNav v-model="category" horizontal @update:model-value="search" />
      </div>
      <form v-if="admin" class="kb-admin-search" @submit.prevent="search">
        <input v-model="q" placeholder="搜索内容标题" aria-label="搜索知识" /><button
          class="button"
          type="submit"
        >
          查询</button
        ><button class="button" type="button" @click="reset">重置</button>
      </form>
      <nav v-if="admin" class="kb-states" aria-label="内容状态">
        <button
          v-for="tab in [
            { value: '', label: '全部' },
            { value: 'PUBLISHED', label: '已发布' },
            { value: 'DRAFT', label: '草稿' },
            { value: 'WITHDRAWN', label: '已下架' },
            { value: 'REVIEW', label: '待发布' },
          ]"
          :key="tab.value"
          :class="{ active: status === tab.value }"
          @click="
            status = tab.value;
            search();
          "
        >
          {{ tab.label }}
        </button>
      </nav>
      <div v-if="!admin" class="kb-resultline">
        <strong
          ><ReferenceName v-if="category" field="categoryId" :value="category" /><template v-else
            >全部内容</template
          ></strong
        ><span>{{ total }} 篇内容</span>
      </div>
      <div v-if="admin && rows.length" class="kb-table-wrap">
        <table>
          <thead>
            <tr>
              <th>内容</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="String(row.id)">
              <td>
                <div class="kb-table-title">
                  <button class="kb-thumb" :aria-label="'预览 ' + row.title" @click="open(row)">
                    <AssetCover
                      :width="240"
                      v-if="row.coverAssetId"
                      :asset-id="row.coverAssetId"
                      :alt="String(row.title)"
                    /><span v-else>暂无封面</span>
                  </button>
                  <div>
                    <button class="kb-title-link" @click="open(row)">{{ row.title }}</button
                    ><small><ReferenceName field="categoryId" :value="row.categoryId" /></small>
                  </div>
                </div>
              </td>
              <td>
                <span class="kb-badge" :class="{ live: row.state === 'PUBLISHED' }">{{
                  name(row.state)
                }}</span>
              </td>
              <td class="kb-meta">{{ display(row.updatedAt) }}</td>
              <td>
                <div class="kb-row-actions">
                  <button v-if="can('put_admin_knowledge_id')" @click="open(row, true)">编辑</button
                  ><button @click="open(row)">预览</button
                  ><button
                    v-if="row.state !== 'PUBLISHED' && canPublish"
                    @click="action = { row, kind: 'publish' }"
                  >
                    发布</button
                  ><button
                    v-if="row.state === 'PUBLISHED' && can('post_admin_knowledge_id_withdraw')"
                    @click="action = { row, kind: 'withdraw' }"
                  >
                    下架</button
                  ><button
                    v-if="row.state !== 'PUBLISHED' && can('delete_admin_knowledge_id')"
                    class="danger"
                    @click="action = { row, kind: 'delete' }"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="!admin && rows.length" class="kb-grid">
        <article v-for="row in rows" :key="String(row.id)" class="kb-card">
          <button class="kb-card-cover" :aria-label="'查看 ' + row.title" @click="open(row)">
            <AssetCover
              :width="800"
              v-if="row.coverAssetId"
              :asset-id="row.coverAssetId"
              :alt="String(row.title)"
            /><span v-else class="kb-no-cover">{{ row.title }}</span>
          </button>
          <div class="kb-card-body">
            <div class="kb-category">
              <ReferenceName field="categoryId" :value="row.categoryId" />
            </div>
            <h2>
              <button @click="open(row)">{{ row.title }}</button>
            </h2>
            <p v-if="excerpt(row)" class="kb-excerpt">{{ excerpt(row) }}</p>
            <footer>
              <span>{{ display(row.updatedAt) }}</span
              ><button @click="open(row)">查看内容</button>
            </footer>
          </div>
        </article>
      </div>
      <div v-else class="kb-empty">
        <h2>暂无相关内容</h2>
        <p>可以尝试其他关键词或分类。</p>
        <button class="button" @click="reset">重置筛选</button>
      </div>
      <footer class="kb-pagination">
        <span>共 {{ total }} 条</span
        ><AppSelect v-model="size" aria-label="每页条数" @update:model-value="search"
          ><option :value="12">每页12条</option>
          <option :value="24">每页24条</option>
          <option :value="48">每页48条</option></AppSelect
        ><button
          class="button"
          :disabled="page <= 1"
          @click="
            page--;
            router.replace({ path: base, query: listQuery() });
          "
        >
          上一页</button
        ><span>{{ page }} / {{ Math.max(1, Math.ceil(total / size)) }}</span
        ><button
          class="button"
          :disabled="page * size >= total"
          @click="
            page++;
            router.replace({ path: base, query: listQuery() });
          "
        >
          下一页
        </button>
      </footer>
    </template>
    <CompactDialog
      v-if="action"
      :title="
        action.kind === 'publish'
          ? '发布内容'
          : action.kind === 'withdraw'
            ? '下架内容'
            : '删除内容'
      "
      :busy="busy"
      @back="!busy && (action = null)"
      ><p>
        确认{{
          action.kind === 'publish' ? '发布' : action.kind === 'withdraw' ? '下架' : '删除'
        }}“{{ action.row.title }}”？
      </p>
      <p class="muted">
        {{
          action.kind === 'publish'
            ? '发布后有权限的学生可以阅读正文和媒体。'
            : '操作完成后学生将无法访问这篇内容。'
        }}
      </p>
      <p v-if="error" class="error">{{ error }}</p>
      <template #footer
        ><button class="button" :disabled="busy" @click="action = null">取消</button
        ><button class="button primary" :disabled="busy" @click="act">
          {{ busy ? '处理中…' : '确认' }}
        </button></template
      ></CompactDialog
    >
  </section>
</template>
<style scoped>
.knowledge-library {
  max-width: 1280px;
  margin: 0 auto;
  color: #292638;
}
.kb-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 0 0 24px;
}
.kb-heading h1 {
  font-size: 28px;
  margin: 0 0 5px;
  line-height: 1.5;
}
.kb-heading p {
  font-size: 14px;
  color: #888092;
  margin: 0;
}
.kb-search,
.kb-admin-search {
  display: flex;
  gap: 8px;
  align-items: center;
}
.kb-search input {
  width: 270px;
}
.kb-admin-search {
  margin: 18px 0;
}
.kb-admin-search input {
  max-width: 360px;
}
.kb-categories {
  background: white;
  border: 1px solid #e6e1ec;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 24px;
}
.kb-resultline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 16px;
  font-size: 14px;
}
.kb-resultline span {
  color: #8e8799;
  font-size: 12px;
}
.kb-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
}
.kb-card {
  border: 1px solid #e4dfee;
  border-radius: 12px;
  overflow: hidden;
  background: white;
  display: flex;
  flex-direction: column;
}
.kb-card-cover {
  width: 100%;
  height: 205px;
  border: 0;
  padding: 0;
  background: #f0edf5;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.kb-card-cover :deep(img),
.kb-thumb :deep(img),
.kb-editor-cover :deep(img) {
  object-fit: contain;
  width: 100%;
  height: 100%;
}
.kb-no-cover {
  padding: 24px;
  color: #8a7c9e;
  font-size: 22px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.kb-card-body {
  padding: 18px 20px;
  display: flex;
  flex: 1;
  flex-direction: column;
}
.kb-category {
  font-size: 12px;
  color: #907d9e;
}
.kb-card h2 {
  margin: 8px 0 10px;
  font-size: 17px;
  line-height: 1.55;
}
.kb-card h2 button,
.kb-title-link {
  font: inherit;
  font-weight: 600;
  color: inherit;
  background: none;
  border: 0;
  padding: 0;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.kb-excerpt {
  font-size: 13px;
  color: #8a8097;
  line-height: 1.8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0 0 20px;
}
.kb-card footer {
  margin-top: auto;
  padding-top: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #948a9f;
}
.kb-card footer button,
.kb-row-actions button {
  border: 0;
  background: none;
  color: #8064ad;
  padding: 4px;
  font-size: 12px;
  cursor: pointer;
}
.kb-pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin: 24px 0;
  font-size: 12px;
  color: #8c8198;
}
.kb-pagination :deep(.app-select) {
  width: 120px;
}
.kb-empty {
  padding: 60px 20px;
  text-align: center;
  border: 1px solid #e7e1ed;
  background: white;
  border-radius: 12px;
}
.kb-empty h2 {
  font-size: 18px;
}
.kb-empty p {
  color: #8c8299;
  font-size: 13px;
}
.kb-states {
  display: flex;
  gap: 8px;
  margin: 16px 0;
  overflow: auto;
}
.kb-states button {
  border: 0;
  background: none;
  color: #83778f;
  padding: 9px 16px;
  border-radius: 7px;
  white-space: nowrap;
  font-size: 13px;
}
.kb-states .active {
  background: #ede7f7;
  color: #7055ad;
}
.kb-table-wrap {
  background: white;
  border: 1px solid #e6e0ec;
  border-radius: 12px;
  overflow: auto;
}
.kb-table-wrap table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
  font-size: 13px;
}
.kb-table-wrap th {
  background: #faf8fc;
  color: #8c8198;
  text-align: left;
  font-weight: 500;
  padding: 14px 18px;
}
.kb-table-wrap td {
  padding: 18px;
  border-top: 1px solid #eee8f2;
}
.kb-table-title {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 220px;
}
.kb-table-title small {
  display: block;
  color: #93849f;
  margin-top: 6px;
  font-size: 12px;
}
.kb-title-link {
  max-width: 290px;
}
.kb-thumb {
  width: 96px;
  height: 64px;
  flex-shrink: 0;
  border: 0;
  background: #f1edf6;
  border-radius: 6px;
  overflow: hidden;
  padding: 0;
  color: #9a8ea6;
  font-size: 12px;
  cursor: pointer;
}
.kb-badge {
  padding: 4px 10px;
  background: #f0eaf7;
  color: #9078a0;
  border-radius: 20px;
  font-size: 11px;
  white-space: nowrap;
}
.kb-badge.live {
  background: #eaf5ee;
  color: #528a6b;
}
.kb-meta {
  font-size: 12px;
  color: #96889f;
}
.kb-row-actions {
  display: flex;
  gap: 9px;
  white-space: nowrap;
}
.kb-row-actions .danger {
  color: #ad5467;
}
.kb-back {
  margin-bottom: 18px;
}
.kb-reading-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 28px;
  align-items: start;
}
.kb-article {
  background: white;
  border: 1px solid #e6dfec;
  border-radius: 12px;
  overflow: hidden;
  min-width: 0;
}
.kb-article-heading {
  padding: 28px 32px 18px;
}
.kb-article-heading h1 {
  font-size: 28px;
  line-height: 1.5;
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.kb-article-body {
  padding: 0 32px 32px;
}
.kb-outline {
  position: sticky;
  top: 22px;
  background: white;
  border: 1px solid #e6dfec;
  border-radius: 12px;
  padding: 18px;
}
.kb-outline :deep(.reading-outline) {
  border: 0;
  padding: 0;
}
.kb-outline :deep(.button) {
  white-space: normal;
  font-size: 12px;
}
.kb-editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 22px;
}
.kb-editor-main,
.kb-settings {
  background: white;
  border: 1px solid #e5deed;
  border-radius: 12px;
  padding: 24px;
  min-width: 0;
}
.kb-title-input {
  font-size: 25px !important;
  font-weight: 600;
  border: 0 !important;
  border-bottom: 1px solid #eee6f3 !important;
  border-radius: 0 !important;
  padding: 8px 0 18px !important;
  margin-bottom: 16px;
  width: 100%;
}
.kb-media-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.kb-media-toolbar span {
  font-size: 12px;
  color: #97899f;
}
.kb-main-media {
  margin: 0 0 18px;
}
.kb-main-media > label,
.kb-settings > label {
  display: block;
  font-size: 12px;
  color: #85728f;
  margin: 0 0 10px;
}
.kb-settings > label:not(:first-child) {
  margin-top: 20px;
}
.kb-settings :deep(.app-select) {
  display: flex;
  width: 100%;
  margin-top: 8px;
  min-height: 40px;
}
.kb-settings :deep(.reference) {
  margin-top: 8px;
}
.kb-settings :deep(.material-field-actions) > span {
  min-width: 100%;
  font-size: 12px;
}
.kb-settings :deep(.button) {
  font-size: 12px;
  padding: 7px 10px;
}
.kb-settings p {
  font-size: 12px;
}
.kb-editor-cover {
  height: 145px;
  background: #f0ebf5;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 10px;
}
.kb-savebar {
  position: sticky;
  bottom: 0;
  background: #fffffff5;
  border: 1px solid #e4ddeb;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 22px;
  margin-top: 22px;
  z-index: 5;
}
.kb-savebar > span {
  font-size: 12px;
  color: #97869f;
}
.kb-savebar > div {
  display: flex;
  gap: 10px;
}
.kb-editor-main :deep(.knowledge-editor) {
  border: 0;
}
.kb-editor-main :deep(.tiptap) {
  min-height: 350px;
}
.kb-editor-main :deep(.editor-top) {
  background: transparent;
}
.kb-editor-main :deep(.editor-toolbar) {
  background: #faf8fc;
}
@media (max-width: 1000px) {
  .kb-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .kb-reading-layout {
    grid-template-columns: minmax(0, 1fr) 190px;
  }
  .kb-editor-layout {
    grid-template-columns: minmax(0, 1fr) 260px;
  }
  .kb-settings,
  .kb-editor-main {
    padding: 18px;
  }
}
@media (max-width: 700px) {
  .kb-heading {
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 18px;
  }
  .kb-heading h1 {
    font-size: 25px;
  }
  .kb-search {
    width: 100%;
  }
  .kb-search input {
    flex: 1;
    min-width: 0;
  }
  .kb-categories {
    padding: 8px;
  }
  .kb-reading-layout,
  .kb-editor-layout {
    grid-template-columns: 1fr;
  }
  .kb-outline {
    position: static;
    order: 2;
  }
  .kb-article-heading {
    padding: 20px;
  }
  .kb-article-heading h1 {
    font-size: 23px;
  }
  .kb-article-body {
    padding: 0 18px 22px;
  }
  .kb-savebar {
    padding: 12px;
  }
  .kb-savebar > span {
    display: none;
  }
  .kb-savebar > div {
    width: 100%;
    justify-content: flex-end;
  }
  .kb-pagination {
    gap: 8px;
  }
  .kb-admin-search input {
    min-width: 0;
  }
  .kb-card-cover {
    height: 190px;
  }
  .kb-title-input {
    font-size: 22px !important;
  }
}
@media (max-width: 480px) {
  .kb-grid {
    grid-template-columns: 1fr;
  }
  .kb-card-cover {
    height: 210px;
  }
  .kb-card-body {
    padding: 16px 18px;
  }
  .kb-pagination :deep(.app-select) {
    width: 112px;
  }
}
</style>
