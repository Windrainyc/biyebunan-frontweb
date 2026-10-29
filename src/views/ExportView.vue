<script setup lang="ts">
import AppSelect from '../components/AppSelect.vue';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { display } from '../config/labels';
import type { Row } from '../types/api';
const kind = ref('ORDERS'),
  from = ref(''),
  to = ref(''),
  job = ref<Row | null>(null),
  error = ref(''),
  busy = ref(false),
  download = ref(''),
  restored = ref(false);
let expiry: ReturnType<typeof setTimeout> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined,
  closed = false;
const attempt = writeAttempt();
const route = useRoute(),
  router = useRouter();
onMounted(async () => {
  const id = route.query.job;
  if (typeof id !== 'string') return;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    error.value = '导出任务编号格式不正确';
    return;
  }
  restored.value = true;
  job.value = { id, state: 'PENDING', progress: 0 };
  busy.value = true;
  await poll();
});
onBeforeUnmount(() => {
  closed = true;
  clearTimeout(timer);
  clearTimeout(expiry);
});
async function poll() {
  if (closed || !job.value?.id) return;
  clearTimeout(timer);
  const id = job.value.id;
  try {
    const result = await request<Row>(`/${auth.platform}/jobs/${id}`);
    if (closed || job.value?.id !== id) return;
    job.value = result;
    if (['QUEUED', 'RUNNING', 'PENDING'].includes(String(job.value.state)))
      timer = setTimeout(poll, 2500);
    else busy.value = false;
  } catch (e) {
    if (!closed && job.value?.id === id) {
      error.value = errorText(e);
      busy.value = false;
    }
  }
}
async function create() {
  busy.value = true;
  restored.value = false;
  error.value = '';
  download.value = '';
  job.value = null;
  clearTimeout(timer);
  clearTimeout(expiry);
  try {
    const body = { kind: kind.value, from: from.value, to: to.value };
    job.value = await request<Row>(`/${auth.platform}/exports`, {
      method: 'POST',
      body,
      key: attempt(body),
    });
    if (closed) return;
    // 仅保存非秘密任务编号；恢复时仍经服务端检查平台、权限和创建人归属。
    await router.replace({ query: { ...route.query, job: String(job.value.id) } });
    await poll();
  } catch (e) {
    error.value = errorText(e);
    busy.value = false;
  }
}
async function getDownload() {
  const id = job.value?.id;
  if (!id) return;
  error.value = '';
  download.value = '';
  try {
    const result = await request<{ url: string; expiresAt: string }>(
      `/${auth.platform}/jobs/${id}/download`,
      { method: 'POST' },
    );
    const url = new URL(result.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('下载地址无效');
    const ttl = Date.parse(result.expiresAt) - Date.now();
    if (!Number.isFinite(ttl) || ttl <= 0) throw new Error('下载授权已过期，请重新获取');
    // 新任务开始后丢弃旧任务的迟到授权，避免下载与当前结果不一致。
    if (closed || job.value?.id !== id) return;
    clearTimeout(expiry);
    download.value = url.toString();
    expiry = setTimeout(
      () => {
        download.value = '';
      },
      Math.min(ttl, 2147483647),
    );
  } catch (e) {
    if (!closed && job.value?.id === id) error.value = errorText(e);
  }
}
</script>
<template>
  <section>
    <h1>数据导出</h1>
    <p class="muted">生成指定期间的数据文件，按当前权限和数据归属过滤。最长可查询366天。</p>
    <form class="export-form" @submit.prevent="create">
      <label
        >数据类型<AppSelect v-model="kind">
          <option value="ORDERS">软件订单</option>
          <option value="PROJECTS">软件项目</option>
          <option v-if="auth.platform === 'admin'" value="USAGE">模型用量</option>
          <option v-if="auth.platform === 'admin'" value="AUDIT">审计记录</option>
        </AppSelect></label
      ><label>开始日期<input v-model="from" type="date" :max="to" required /></label
      ><label>结束日期<input v-model="to" type="date" :min="from" required /></label
      ><button class="button primary" :disabled="busy">
        {{ busy ? '正在生成…' : '创建导出任务' }}
      </button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <section v-if="job" class="card export-result">
      <h2>导出任务</h2>
      <p v-if="restored" class="muted">已恢复之前的导出任务。上方表单用于创建新任务。</p>
      <p v-if="job.createdAt">创建时间：{{ display(job.createdAt) }}</p>
      <p>状态：{{ display(job.state) }} · 进度：{{ job.progress }}%</p>
      <p v-if="job.errorCode" class="error">任务未完成，请在异步任务中查看处理结果。</p>
      <button class="button" @click="poll">刷新进度</button
      ><button v-if="job.state === 'SUCCEEDED'" class="button primary" @click="getDownload">
        获取下载链接</button
      ><a v-if="download" :href="download" rel="noopener noreferrer" class="button">下载导出文件</a>
    </section>
  </section>
</template>
<style scoped>
.export-form {
  max-width: 720px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  padding: 24px;
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 12px;
  margin-top: 24px;
}
.export-form > label:first-child {
  grid-column: 1 / -1;
}
.export-form > .button {
  grid-column: 1 / -1;
  justify-self: end;
}
@media (max-width: 640px) {
  .export-form {
    grid-template-columns: 1fr;
  }
}
.export-form label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
.export-result {
  margin-top: 24px;
  padding: 24px;
}
.export-result button,
.export-result a {
  margin-right: 12px;
}
</style>
