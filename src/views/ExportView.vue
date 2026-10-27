<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
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
  download = ref('');
let timer: ReturnType<typeof setTimeout> | undefined,
  closed = false;
const attempt = writeAttempt();
onBeforeUnmount(() => {
  closed = true;
  clearTimeout(timer);
});
async function poll() {
  if (closed || !job.value?.id) return;
  try {
    job.value = await request<Row>(`/${auth.platform}/jobs/${job.value.id}`);
    if (['QUEUED', 'RUNNING', 'PENDING'].includes(String(job.value.state)))
      timer = setTimeout(poll, 2500);
    else busy.value = false;
  } catch (e) {
    error.value = errorText(e);
    busy.value = false;
  }
}
async function create() {
  busy.value = true;
  error.value = '';
  download.value = '';
  try {
    const body = { kind: kind.value, from: from.value, to: to.value };
    job.value = await request<Row>(`/${auth.platform}/exports`, {
      method: 'POST',
      body,
      key: attempt(body),
    });
    await poll();
  } catch (e) {
    error.value = errorText(e);
    busy.value = false;
  }
}
async function getDownload() {
  try {
    const result = await request<{ url: string }>(
      `/${auth.platform}/jobs/${job.value?.id}/download`,
      { method: 'POST' },
    );
    const url = new URL(result.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('下载地址无效');
    download.value = url.toString();
  } catch (e) {
    error.value = errorText(e);
  }
}
</script>
<template>
  <section>
    <h1>数据导出</h1>
    <p class="muted">生成指定期间的数据文件，按当前权限和数据归属过滤。最长可查询366天。</p>
    <form class="export-form" @submit.prevent="create">
      <label
        >数据类型<select v-model="kind">
          <option value="ORDERS">软件订单</option>
          <option value="PROJECTS">软件项目</option>
          <option v-if="auth.platform === 'admin'" value="USAGE">模型用量</option>
          <option v-if="auth.platform === 'admin'" value="AUDIT">审计记录</option>
        </select></label
      ><label>开始日期<input v-model="from" type="date" :max="to" required /></label
      ><label>结束日期<input v-model="to" type="date" :min="from" required /></label
      ><button class="button primary" :disabled="busy">
        {{ busy ? '正在生成…' : '创建导出任务' }}
      </button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <section v-if="job" class="card export-result">
      <h2>导出任务</h2>
      <p>状态：{{ display(job.state) }} · 进度：{{ job.progress }}%</p>
      <p v-if="job.errorCode" class="error">任务未完成，请在异步任务中查看处理结果。</p>
      <button class="button" @click="poll">刷新进度</button
      ><button v-if="job.state === 'SUCCEEDED'" class="button primary" @click="getDownload">
        获取下载链接</button
      ><a v-if="download" :href="download" target="_blank" rel="noopener noreferrer" class="button"
        >下载导出文件</a
      >
    </section>
  </section>
</template>
<style scoped>
.export-form {
  max-width: 600px;
  display: grid;
  gap: 18px;
  padding: 24px;
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 12px;
  margin-top: 24px;
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
