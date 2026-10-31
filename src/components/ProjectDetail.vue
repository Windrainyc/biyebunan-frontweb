<script setup lang="ts">
import CreatePage from './CreatePage.vue';
import { useCreateRoute } from '../composables/useCreateRoute';
const milestoneRoute = useCreateRoute('milestone');
const deliveryRoute = useCreateRoute('delivery');
import AppSelect from './AppSelect.vue';
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { display } from '../config/labels';
import type { Row, Page } from '../types/api';
import AssetUpload from './AssetUpload.vue';
const props = withDefaults(
  defineProps<{ project: Row; section?: 'all' | 'milestones' | 'deliveries' }>(),
  { section: 'all' },
);
const emit = defineEmits<{ changed: [] }>();
const attempt = writeAttempt();
const milestoneEdit = ref<Row | null>(null),
  milestoneOpen = ref(false),
  milestoneName = ref(''),
  milestoneDate = ref(''),
  milestoneWeight = ref(10),
  milestoneCompleted = ref(false);
function editMilestone(row?: Row) {
  milestoneEdit.value = row || null;
  milestoneName.value = String(row?.name || '');
  milestoneDate.value = String(row?.dueDate || '');
  milestoneWeight.value = Number(row?.weight || 10);
  milestoneCompleted.value = Boolean(row?.completed);
  milestoneOpen.value = true;
}
async function saveMilestone() {
  busy.value = true;
  try {
    const body = {
      name: milestoneName.value,
      dueDate: milestoneDate.value,
      weight: milestoneWeight.value,
      completed: milestoneCompleted.value,
    };
    const path = milestoneEdit.value
      ? `/admin/milestones/${milestoneEdit.value.id}`
      : `/admin/projects/${props.project.id}/milestones`;
    await request(path, {
      method: milestoneEdit.value ? 'PUT' : 'POST',
      body,
      version: milestoneEdit.value?.version,
      key: attempt({ path, ...body }),
    });
    milestoneOpen.value = false;
    if (milestoneRoute.active.value) await milestoneRoute.close();
    await load();
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}

const deliveries = ref<Row[]>([]),
  milestones = ref<Row[]>([]),
  error = ref(''),
  uploaded = ref<Row | null>(null),
  kind = ref('TASK'),
  note = ref(''),
  reason = ref(''),
  busy = ref(false);
const deliveryPage = ref(1),
  milestonePage = ref(1),
  deliveryTotal = ref(0),
  milestoneTotal = ref(0),
  loading = ref(false);
const pageSize = 20;
let loadGeneration = 0;
onBeforeUnmount(() => {
  loadGeneration++;
});
const kinds: Record<string, string> = {
  TASK: '任务书',
  PROPOSAL: '开题报告',
  THESIS_TEMPLATE: '论文模板',
  SOURCE_CODE: '源代码',
  QA_ATTACHMENT: '答疑资料',
  RECORDING: '操作录屏',
};
async function load() {
  if (auth.platform === 'partner') return;
  const generation = ++loadGeneration;
  loading.value = true;
  error.value = '';
  deliveries.value = [];
  milestones.value = [];
  deliveryTotal.value = 0;
  milestoneTotal.value = 0;
  try {
    const [d, m] = await Promise.all([
      props.section === 'milestones'
        ? Promise.resolve({ items: [], total: 0 })
        : request<Page<Row>>(`/${auth.platform}/projects/${props.project.id}/deliveries`, {
            query: { page: deliveryPage.value, size: pageSize },
          }),
      props.section === 'deliveries'
        ? Promise.resolve({ items: [], total: 0 })
        : request<Page<Row>>(`/${auth.platform}/projects/${props.project.id}/milestones`, {
            query: { page: milestonePage.value, size: pageSize },
          }),
    ]);
    if (generation !== loadGeneration) return;
    deliveryTotal.value = d.total;
    milestoneTotal.value = m.total;
    deliveries.value = d.items;
    milestones.value = m.items;
  } catch (e) {
    if (generation === loadGeneration) error.value = errorText(e);
  } finally {
    if (generation === loadGeneration) loading.value = false;
  }
}
async function add() {
  if (!uploaded.value) return;
  busy.value = true;
  try {
    await request(`/admin/projects/${props.project.id}/deliveries`, {
      method: 'POST',
      body: { kind: kind.value, assetId: uploaded.value.id, note: note.value },
      key: attempt({ kind: kind.value, assetId: uploaded.value.id, note: note.value }),
    });
    uploaded.value = null;
    note.value = '';
    await deliveryRoute.close();
    await load();
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function publication(row: Row, publish: boolean) {
  busy.value = true;
  try {
    await request(`/admin/deliveries/${row.id}/${publish ? 'publish' : 'withdraw'}`, {
      method: 'POST',
      body: { reason: reason.value },
      version: row.version,
      key: attempt({ id: row.id, publish, reason: reason.value, version: row.version }),
    });
    await load();
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
const downloadGrant = ref<{ id: unknown; url: string } | null>(null);
let downloadTimer: ReturnType<typeof setTimeout> | undefined;
let downloadGeneration = 0;
onBeforeUnmount(() => {
  downloadGeneration++;
  clearTimeout(downloadTimer);
});
async function download(row: Row) {
  // 只展示最后一次请求的授权，避免快速切换文件或离开页面后回写旧链接。
  const generation = ++downloadGeneration;
  error.value = '';
  downloadGrant.value = null;
  clearTimeout(downloadTimer);
  try {
    const grant = await request<{ url: string; expiresAt: string }>(
      `/${auth.platform}/assets/${row.assetId}/download`,
      { method: 'POST' },
    );
    if (generation !== downloadGeneration) return;
    const url = new URL(grant.url);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('下载地址无效');
    const remaining = Date.parse(grant.expiresAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0)
      throw new Error('下载授权已过期，请重新获取');
    downloadGrant.value = { id: row.id, url: url.toString() };
    downloadTimer = setTimeout(() => {
      downloadGrant.value = null;
    }, remaining);
  } catch (e) {
    if (generation === downloadGeneration) error.value = errorText(e);
  }
}
watch(
  milestoneRoute.active,
  (active) => {
    if (active && auth.platform === 'admin') editMilestone();
    else milestoneOpen.value = false;
  },
  { immediate: true },
);
onMounted(load);
</script>
<template>
  <section class="project-detail">
    <p v-if="error" class="error" role="alert">
      {{ error }} <button class="button" @click="load">重试</button>
    </p>
    <p v-if="loading" class="muted" role="status">正在加载项目资料…</p>
    <template v-if="section !== 'deliveries'">
      <h3>项目里程碑</h3>
      <button
        v-if="auth.platform === 'admin'"
        class="button"
        @click="milestoneRoute.open({ source: String(project.id) })"
      >
        新增里程碑
      </button>
      <p v-if="!loading && !error && !milestones.length" class="muted">暂无里程碑</p>
      <div v-for="m in milestones" :key="String(m.id)" class="milestone">
        <strong>{{ m.name }}</strong
        ><span
          >{{ display(m.dueDate) }} · {{ m.weight }}% ·
          {{ m.completed ? '已完成' : '进行中' }}</span
        >
        <button v-if="auth.platform === 'admin'" class="button" @click="editMilestone(m)">
          编辑
        </button>
      </div>
      <component
        :is="milestoneRoute.active.value ? CreatePage : 'div'"
        v-if="milestoneOpen"
        title="新增里程碑"
        :description="String(project.title || '')"
        :busy="busy"
        @back="milestoneRoute.close"
      >
        <p v-if="error && milestoneRoute.active.value" class="error" role="alert">{{ error }}</p>
        <form class="form-grid" @submit.prevent="saveMilestone">
          <label>里程碑名称<input v-model="milestoneName" maxlength="200" required /></label
          ><label
            >计划日期<input
              v-model="milestoneDate"
              type="date"
              :max="String(project.deliveryDate)"
              required /></label
          ><label
            >进度权重<input
              v-model.number="milestoneWeight"
              type="number"
              min="1"
              max="100"
              required /></label
          ><label><input v-model="milestoneCompleted" type="checkbox" />已完成</label>
          <footer class="wide">
            <button
              type="button"
              class="button"
              :disabled="busy"
              @click="
                milestoneRoute.active.value ? milestoneRoute.close() : (milestoneOpen = false)
              "
            >
              取消</button
            ><button class="button primary" :disabled="busy">保存里程碑</button>
          </footer>
        </form>
      </component>
      <div class="detail-pagination" aria-label="里程碑分页">
        <span>共 {{ milestoneTotal }} 条 · 第 {{ milestonePage }} 页</span>
        <button
          class="button"
          :disabled="loading || milestonePage === 1"
          @click="
            milestonePage--;
            load();
          "
        >
          上一页里程碑
        </button>
        <button
          class="button"
          :disabled="loading || milestonePage * pageSize >= milestoneTotal"
          @click="
            milestonePage++;
            load();
          "
        >
          下一页里程碑
        </button>
      </div>
    </template>
    <template v-if="section !== 'milestones'">
      <h3>交付版本</h3>
      <p v-if="!loading && !error && !deliveries.length" class="muted">暂无可查看的交付版本</p>
      <article v-for="d in deliveries" :key="String(d.id)" class="delivery">
        <div>
          <strong>{{ kinds[String(d.kind)] || '交付文件' }}</strong
          ><span>第{{ d.versionNumber }}版 · {{ display(d.state) }}</span>
        </div>
        <p>{{ d.note }}</p>
        <button class="button" @click="download(d)">下载文件</button
        ><a
          v-if="downloadGrant && downloadGrant.id === d.id"
          class="button"
          :href="downloadGrant.url"
          rel="noopener noreferrer"
          >保存已授权文件</a
        ><template v-if="auth.platform === 'admin'"
          ><button
            v-if="d.state === 'READY'"
            class="button"
            :disabled="busy || !reason"
            @click="publication(d, true)"
          >
            发布版本</button
          ><button
            v-if="d.state === 'PUBLISHED'"
            class="button"
            :disabled="busy || !reason"
            @click="publication(d, false)"
          >
            撤回版本
          </button></template
        >
      </article>
      <div class="detail-pagination" aria-label="交付版本分页">
        <span>共 {{ deliveryTotal }} 条 · 第 {{ deliveryPage }} 页</span>
        <button
          class="button"
          :disabled="loading || deliveryPage === 1"
          @click="
            deliveryPage--;
            load();
          "
        >
          上一页版本
        </button>
        <button
          class="button"
          :disabled="loading || deliveryPage * pageSize >= deliveryTotal"
          @click="
            deliveryPage++;
            load();
          "
        >
          下一页版本
        </button>
      </div>
      <template v-if="auth.platform === 'admin'"
        ><label>发布或撤回原因<input v-model="reason" maxlength="200" /></label>
        <button class="button primary" @click="deliveryRoute.open({ source: String(project.id) })">
          新增交付版本
        </button>
        <CreatePage
          v-if="deliveryRoute.active.value"
          title="新增交付版本"
          :description="String(project.title || '') + ' · 历史版本将保留，不可覆盖。'"
          :busy="busy"
          @back="deliveryRoute.close"
        >
          <p v-if="error" class="error" role="alert">{{ error }}</p>
          <AssetUpload
            owner-type="PROJECT"
            :owner-id="String(project.id)"
            @ready="uploaded = $event"
          />
          <form v-if="uploaded" class="form-grid" @submit.prevent="add">
            <label
              >资料类型<AppSelect v-model="kind">
                <option v-for="(title, value) in kinds" :key="value" :value="value">
                  {{ title }}
                </option>
              </AppSelect></label
            ><label>版本说明<input v-model="note" maxlength="200" required /></label>
            <footer class="wide">
              <button type="button" class="button" :disabled="busy" @click="deliveryRoute.close">
                取消</button
              ><button class="button primary" :disabled="busy">创建交付版本</button>
            </footer>
          </form></CreatePage
        ></template
      >
    </template>
  </section>
</template>
<style scoped>
.detail-pagination {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
  font-size: 13px;
}
.milestone,
.delivery {
  padding: 16px;
  border: 1px solid #e2e6ef;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}
.milestone {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.milestone span,
.delivery span {
  color: #748096;
  font-size: 12px;
}
.delivery > div {
  display: flex;
  gap: 14px;
  justify-content: space-between;
}
.delivery button {
  margin-right: 8px;
}
.delivery-form {
  display: grid;
  gap: 14px;
  margin-top: 14px;
}
label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
</style>
