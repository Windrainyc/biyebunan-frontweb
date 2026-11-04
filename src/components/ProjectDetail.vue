<script setup lang="ts">
import CreatePage from './CreatePage.vue';
import { useCreateRoute } from '../composables/useCreateRoute';
const deliveryRoute = useCreateRoute('delivery');
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { display } from '../config/labels';
import type { Row, Page } from '../types/api';
import AssetUpload from './AssetUpload.vue';
const props = withDefaults(
  defineProps<{ project: Row; section?: 'all' | 'milestones' | 'deliveries' }>(),
  { section: 'deliveries' },
);
const emit = defineEmits<{ changed: [] }>();
const attempt = writeAttempt();
const deliveries = ref<Row[]>([]),
  error = ref(''),
  batchFiles = ref<Record<string, Row>>({}),
  note = ref(''),
  reason = ref(''),
  busy = ref(false);
const deliveryPage = ref(1),
  deliveryTotal = ref(0),
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
  deliveryTotal.value = 0;
  try {
    const d = await request<Page<Row>>(
      `/${auth.platform}/projects/${props.project.id}/deliveries`,
      { query: { page: deliveryPage.value, size: pageSize } },
    );
    if (generation !== loadGeneration) return;
    deliveryTotal.value = d.total;
    deliveries.value = d.items;
  } catch (e) {
    if (generation === loadGeneration) error.value = errorText(e);
  } finally {
    if (generation === loadGeneration) loading.value = false;
  }
}
async function add() {
  if (!Object.keys(batchFiles.value).length) return;
  busy.value = true;
  try {
    const body = {
      note: note.value,
      files: Object.entries(batchFiles.value).map(([kind, file]) => ({
        kind,
        assetId: file.id,
        note: note.value,
      })),
    };
    await request(`/admin/projects/${props.project.id}/delivery-releases`, {
      method: 'POST',
      body,
      key: attempt(body),
    });
    batchFiles.value = {};
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
onMounted(load);
</script>
<template>
  <section class="project-detail">
    <p v-if="error" class="error" role="alert">
      {{ error }} <button class="button" @click="load">重试</button>
    </p>
    <p v-if="loading" class="muted" role="status">正在加载项目资料…</p>
    <div class="delivery-content">
      <h3>交付版本</h3>
      <p v-if="!loading && !error && !deliveries.length" class="muted">暂无可查看的交付版本</p>
      <article v-for="d in deliveries" :key="String(d.id)" class="delivery">
        <div>
          <strong>{{ kinds[String(d.kind)] || '交付文件' }}</strong
          ><span>第{{ d.releaseNumber || d.versionNumber }}版 · {{ display(d.state) }}</span>
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
          <form class="release-form" @submit.prevent="add">
            <div v-for="(title, value) in kinds" :key="value" class="release-file-row">
              <strong>{{ title }}</strong>
              <div>
                <AssetUpload
                  owner-type="PROJECT"
                  :owner-id="String(project.id)"
                  @ready="batchFiles[String(value)] = $event"
                />
                <p v-if="batchFiles[String(value)]" class="success">
                  已选择：{{ batchFiles[String(value)].filename }}
                  <button
                    type="button"
                    class="text-button"
                    @click="delete batchFiles[String(value)]"
                  >
                    移除本次更新
                  </button>
                </p>
              </div>
            </div>
            <label>版本说明<input v-model="note" maxlength="1000" required /></label>
            <p class="muted">
              每类可更新一个文件。未更新的资料保留当前版本，所选文件将作为同一批次发布。
            </p>
            <footer class="wide">
              <button type="button" class="button" :disabled="busy" @click="deliveryRoute.close">
                取消</button
              ><button class="button primary" :disabled="busy || !Object.keys(batchFiles).length">
                发布本次版本
              </button>
            </footer>
          </form></CreatePage
        ></template
      >
    </div>
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

<style scoped>
.release-form {
  display: grid;
  gap: 18px;
}
.release-file-row {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #edf0f4;
}
.release-file-row > strong {
  font-size: 14px;
  padding-top: 12px;
}
@media (max-width: 600px) {
  .release-file-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
