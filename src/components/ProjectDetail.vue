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
const fileMetadata = ref<Record<string, Row>>({});
const releaseRows = ref<Row[]>([]),
  selectedRelease = ref<Row | null>(null),
  legacyFiles = ref(false),
  versionLabel = ref('v1.0.0');
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
      `/${auth.platform}/projects/${props.project.id}/${auth.platform === 'admin' && !legacyFiles.value ? 'delivery-releases' : 'deliveries'}`,
      { query: { page: deliveryPage.value, size: pageSize } },
    );
    if (generation !== loadGeneration) return;
    deliveryTotal.value = d.total;
    selectedRelease.value = null;
    if (auth.platform === 'admin' && !legacyFiles.value) {
      releaseRows.value = d.items;
      if (deliveryPage.value === 1) {
        const latest = String(d.items[0]?.label || '');
        const match = latest.match(/^v(\d+)\.(\d+)\.(\d+)$/);
        versionLabel.value = match ? `v${match[1]}.${match[2]}.${Number(match[3]) + 1}` : 'v1.0.0';
      }
    } else deliveries.value = d.items;
  } catch (e) {
    if (generation === loadGeneration) error.value = errorText(e);
  } finally {
    if (generation === loadGeneration) loading.value = false;
  }
}
async function openRelease(row: Row) {
  const generation = ++loadGeneration;
  loading.value = true;
  error.value = '';
  deliveries.value = [];
  selectedRelease.value = row;
  try {
    const files = await request<Row[]>(
      `/admin/projects/${props.project.id}/delivery-releases/${row.id}`,
    );
    if (generation === loadGeneration) deliveries.value = files;
    const metadata = await Promise.allSettled(
      files.map((file) => request<Row>(`/admin/assets/${file.assetId}`)),
    );
    if (generation === loadGeneration) {
      fileMetadata.value = Object.fromEntries(
        metadata.flatMap((result, index) =>
          result.status === 'fulfilled' ? [[String(files[index]?.assetId), result.value]] : [],
        ),
      );
    }
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
      label: versionLabel.value,
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
      <div class="release-toolbar">
        <h3>{{ selectedRelease ? selectedRelease.label + ' · 版本文件' : '交付版本' }}</h3>
        <button v-if="selectedRelease" class="text-button" @click="load">← 返回版本列表</button>
        <button
          v-else-if="auth.platform === 'admin'"
          class="text-button"
          @click="
            legacyFiles = !legacyFiles;
            deliveryPage = 1;
            load();
          "
        >
          {{ legacyFiles ? '返回版本列表' : '按文件查看历史记录' }}
        </button>
      </div>
      <div
        v-if="auth.platform === 'admin' && !legacyFiles && !selectedRelease"
        class="release-table-wrap"
      >
        <table class="release-table">
          <thead>
            <tr>
              <th>版本号</th>
              <th>更新说明</th>
              <th>发布时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="release in releaseRows" :key="String(release.id)">
              <td>
                <button class="text-button" @click="openRelease(release)">
                  {{ release.label }}
                </button>
              </td>
              <td>{{ release.note }}</td>
              <td>{{ display(release.createdAt) }}</td>
              <td><button class="text-button" @click="openRelease(release)">查看文件 →</button></td>
            </tr>
          </tbody>
        </table>
        <p v-if="!loading && !error && !releaseRows.length" class="muted">暂无发布版本</p>
      </div>
      <p
        v-if="
          !loading &&
          !error &&
          !deliveries.length &&
          (auth.platform !== 'admin' || legacyFiles || selectedRelease)
        "
        class="muted"
      >
        暂无可查看的交付版本
      </p>
      <article v-for="d in deliveries" :key="String(d.id)" class="delivery">
        <div>
          <strong>{{ kinds[String(d.kind)] || '交付文件' }}</strong
          ><span>第{{ d.releaseNumber || d.versionNumber }}版 · {{ display(d.state) }}</span>
        </div>
        <p v-if="selectedRelease">
          {{ fileMetadata[String(d.assetId)]?.filename || '文件信息暂不可用' }}
          <template v-if="fileMetadata[String(d.assetId)]">
            ·
            {{
              (Number(fileMetadata[String(d.assetId)]?.size || 0) / 1024).toFixed(1)
            }}
            KB</template
          >
          · {{ d.releaseId === selectedRelease.id ? '本次更新' : '沿用先前版本' }}
        </p>
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
      <div v-if="!selectedRelease" class="detail-pagination" aria-label="交付版本分页">
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
        ><label v-if="selectedRelease || legacyFiles"
          >发布或撤回原因<input v-model="reason" maxlength="200"
        /></label>
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
            <label
              >版本号<input
                v-model="versionLabel"
                pattern="v[0-9]{1,6}\.[0-9]{1,6}\.[0-9]{1,6}"
                required
                maxlength="24"
              /><small>默认递增末位，可自行修改。首版为 v1.0.0。</small></label
            >
            <div v-for="(title, value) in kinds" :key="value" class="release-file-row">
              <strong class="release-kind">{{ title }}</strong>
              <div>
                <AssetUpload
                  compact
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
.release-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.release-table-wrap {
  overflow-x: auto;
}
.release-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.release-table th,
.release-table td {
  padding: 16px 12px;
  border-bottom: 1px solid #e9edf4;
  text-align: left;
}
.release-table th {
  background: #f7f9fc;
  color: #7c899d;
  font-weight: 500;
}
.release-table td:nth-child(2) {
  max-width: 380px;
  overflow-wrap: anywhere;
}
</style>

<style scoped>
.release-form {
  display: grid;
  gap: 18px;
}
.release-file-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
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
.release-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.release-table-wrap {
  overflow-x: auto;
}
.release-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.release-table th,
.release-table td {
  padding: 16px 12px;
  border-bottom: 1px solid #e9edf4;
  text-align: left;
}
.release-table th {
  background: #f7f9fc;
  color: #7c899d;
  font-weight: 500;
}
.release-table td:nth-child(2) {
  max-width: 380px;
  overflow-wrap: anywhere;
}
</style>

<style scoped>
.release-kind {
  font-size: 13px;
  font-weight: 500;
  color: #455066;
}
.release-file-row .success {
  font-size: 11px;
  margin: 6px 0;
}
.release-form > .muted {
  font-size: 12px;
}
.release-form .release-file-row :deep(.upload-compact) {
  max-width: 650px;
}
.release-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.release-table-wrap {
  overflow-x: auto;
}
.release-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.release-table th,
.release-table td {
  padding: 16px 12px;
  border-bottom: 1px solid #e9edf4;
  text-align: left;
}
.release-table th {
  background: #f7f9fc;
  color: #7c899d;
  font-weight: 500;
}
.release-table td:nth-child(2) {
  max-width: 380px;
  overflow-wrap: anywhere;
}
</style>
