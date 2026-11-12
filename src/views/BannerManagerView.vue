<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { auth, request, errorText } from '../api/client';
import type { Page } from '../types/api';
import type { Banner } from '../components/banner';
import MaterialField from '../components/MaterialField.vue';
import KnowledgeEditor from '../components/KnowledgeEditor.vue';
import BannerDetail from '../components/BannerDetail.vue';
const rows = ref<Banner[]>([]),
  total = ref(0),
  page = ref(1),
  q = ref(''),
  status = ref(''),
  loading = ref(false),
  busy = ref(false),
  error = ref(''),
  editing = ref(false),
  preview = ref<Banner | null>(null);
const blank = (): Banner => ({
  id: '',
  version: 0,
  title: '',
  subtitle: '',
  coverAssetId: null,
  posterAssetId: null,
  body: '',
  sortOrder: 0,
  status: 'DISABLED',
});
const form = ref<Banner>(blank());
const baseline = ref(JSON.stringify(blank()));
const dirty = computed(() => editing.value && JSON.stringify(form.value) !== baseline.value);
onBeforeRouteLeave(() => !dirty.value || confirm('离开后将丢失未保存的修改，确定离开吗？'));
function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
const writable = () => auth.permissions.includes('banners:write');
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await request<Page<Banner>>('/admin/banners', {
      query: { page: page.value, size: 10, q: q.value, status: status.value },
    });
    rows.value = data.items;
    total.value = data.total;
  } catch (e) {
    error.value = errorText(e);
  } finally {
    loading.value = false;
  }
}
function open(row?: Banner) {
  form.value = row ? { ...row, body: row.body || '', subtitle: row.subtitle || '' } : blank();
  baseline.value = JSON.stringify(form.value);
  editing.value = true;
  error.value = '';
}
function back() {
  if (busy.value) return;
  if (dirty.value && !confirm('离开后将丢失未保存的修改，确定返回吗？')) return;
  editing.value = false;
  error.value = '';
}
async function save() {
  if (!form.value.posterAssetId && !form.value.body.trim()) {
    error.value = '请填写活动详情或选择海报';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const {
      id,
      version,
      title,
      subtitle,
      coverAssetId,
      posterAssetId,
      body: details,
      sortOrder,
      status,
    } = form.value;
    const body = { title, subtitle, coverAssetId, posterAssetId, body: details, sortOrder, status };
    await request('/admin/banners' + (id ? '/' + id : ''), {
      method: id ? 'PUT' : 'POST',
      body,
      version: id ? version : undefined,
    });
    editing.value = false;
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function toggle(row: Banner) {
  busy.value = true;
  error.value = '';
  try {
    await request('/admin/banners/' + row.id + '/status', {
      method: 'POST',
      version: row.version,
      body: { status: row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED' },
    });
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function remove(row: Banner) {
  if (!confirm('确定删除横幅“' + row.title + '”？')) return;
  busy.value = true;
  try {
    await request('/admin/banners/' + row.id, { method: 'DELETE', version: row.version });
    if (rows.value.length === 1 && page.value > 1) page.value--;
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section class="banner-manager">
    <header class="banner-manager-heading">
      <div>
        <h1>{{ editing ? (form.id ? '编辑横幅' : '新增横幅') : '首页横幅' }}</h1>
        <p>展示在学生首页欢迎区下方，点击可查看海报和活动详情。</p>
      </div>
      <button v-if="!editing && writable()" class="button primary" @click="open()">添加横幅</button
      ><button v-if="editing" class="button" :disabled="busy" @click="back">返回列表</button>
    </header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <form v-if="editing" class="banner-editor card" @submit.prevent="save">
      <label
        >横幅标题<input
          v-model="form.title"
          required
          maxlength="80"
          placeholder="例如：毕业作品分享季" /></label
      ><label
        >简短说明<input v-model="form.subtitle" maxlength="160" placeholder="一句话介绍活动"
      /></label>
      <div class="banner-fields">
        <label
          >横幅配图<MaterialField v-model="form.coverAssetId" kind="image" /><small
            >建议横向图片，展示在横幅右侧；可不选。</small
          ></label
        ><label
          >弹窗海报<MaterialField v-model="form.posterAssetId" kind="image" /><small
            >点击横幅后按原比例显示完整海报。</small
          ></label
        >
      </div>
      <KnowledgeEditor v-model="form.body" label="活动详情" :required="false" :max-length="20000" />
      <div class="banner-fields">
        <label
          >展示顺序<input
            v-model.number="form.sortOrder"
            type="number"
            min="0"
            max="9999"
            required
          /><small>数字越小越靠前；首页最多展示前十条启用横幅。</small></label
        ><label
          >展示状态<select v-model="form.status">
            <option value="DISABLED">停用</option>
            <option value="ENABLED">启用</option>
          </select></label
        >
      </div>
      <footer>
        <button type="button" class="button" :disabled="busy" @click="preview = { ...form }">
          预览弹窗</button
        ><button class="button primary" :disabled="busy">
          {{ busy ? '保存中…' : '保存横幅' }}
        </button>
      </footer>
    </form>
    <template v-else
      ><form
        class="banner-filters"
        @submit.prevent="
          page = 1;
          load();
        "
      >
        <input v-model="q" placeholder="搜索横幅标题" aria-label="搜索横幅标题" /><select
          v-model="status"
          aria-label="展示状态"
        >
          <option value="">全部状态</option>
          <option value="ENABLED">启用</option>
          <option value="DISABLED">停用</option></select
        ><button class="button" :disabled="loading">查询</button>
      </form>
      <div class="banner-table card">
        <table>
          <thead>
            <tr>
              <th>横幅标题</th>
              <th>顺序</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>
                <strong>{{ row.title }}</strong
                ><small>{{ row.subtitle }}</small>
              </td>
              <td>{{ row.sortOrder }}</td>
              <td>{{ row.status === 'ENABLED' ? '启用' : '停用' }}</td>
              <td class="banner-actions">
                <button @click="preview = row">预览</button
                ><template v-if="writable()"
                  ><button :disabled="busy" @click="open(row)">编辑</button
                  ><button :disabled="busy" @click="toggle(row)">
                    {{ row.status === 'ENABLED' ? '停用' : '启用' }}</button
                  ><button :disabled="busy" @click="remove(row)">删除</button></template
                >
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!rows.length" class="muted">
          {{ loading ? '加载中…' : '暂无横幅，添加后即可在学生首页展示。' }}
        </p>
      </div>
      <footer class="banner-pagination">
        <span>共 {{ total }} 条</span
        ><button
          class="button"
          :disabled="page <= 1 || loading"
          @click="
            page--;
            load();
          "
        >
          上一页</button
        ><span>{{ page }}</span
        ><button
          class="button"
          :disabled="page * 10 >= total || loading"
          @click="
            page++;
            load();
          "
        >
          下一页
        </button>
      </footer></template
    ><BannerDetail v-if="preview" :banner="preview" @close="preview = null" />
  </section>
</template>
<style scoped>
.banner-manager-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}
.banner-manager h1 {
  font-size: 24px;
  margin: 0 0 7px;
}
.banner-manager-heading p {
  font-size: 13px;
  color: #7b8093;
  margin: 0;
}
.banner-editor {
  padding: 24px;
  display: grid;
  gap: 22px;
  max-width: 1000px;
}
.banner-editor label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
.banner-editor small {
  font-size: 12px;
  color: #888da1;
}
.banner-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.banner-editor footer,
.banner-pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}
.banner-filters {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.banner-filters input {
  max-width: 300px;
}
.banner-filters select {
  width: 140px;
}
.banner-table {
  overflow: auto;
  padding: 16px;
}
.banner-table table {
  width: 100%;
  border-collapse: collapse;
  min-width: 560px;
}
.banner-table th,
.banner-table td {
  padding: 15px 10px;
  text-align: left;
  border-bottom: 1px solid #edf0f5;
  font-size: 13px;
}
.banner-table small {
  display: block;
  color: #9398aa;
  margin-top: 5px;
}
.banner-actions button {
  background: none;
  border: 0;
  color: #6552c5;
  padding: 4px 8px;
}
.banner-pagination {
  margin-top: 16px;
  font-size: 13px;
}
@media (max-width: 600px) {
  .banner-fields {
    grid-template-columns: 1fr;
  }
  .banner-editor {
    padding: 16px;
  }
  .banner-manager-heading {
    align-items: flex-start;
  }
  .banner-manager h1 {
    font-size: 21px;
  }
  .banner-filters {
    flex-wrap: wrap;
  }
  .banner-filters input {
    max-width: 100%;
    width: 100%;
  }
}
</style>
