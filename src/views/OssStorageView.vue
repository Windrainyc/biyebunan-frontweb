<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { request, errorText, auth } from '../api/client';
import AppSelect from '../components/AppSelect.vue';
interface State {
  id: string;
  version: number;
  bucket: string;
  region: string;
  endpoint: string;
  accessTail: string;
  checkedAt: string | null;
  checkError: string | null;
  defaultUpload: boolean;
}
interface Progress {
  queued: number;
  running: number;
  done: number;
  failed: number;
  remainingAssets: number;
  remainingExports: number;
  canStopOldStorage: boolean;
}
const configs = ref<State[]>([]),
  selected = ref(''),
  bucket = ref(''),
  region = ref('cn-beijing'),
  access = ref(''),
  secret = ref(''),
  busy = ref(false),
  error = ref(''),
  message = ref(''),
  progress = ref<Progress | null>(null);
let alive = true;
function choose(id: string) {
  selected.value = id;
  const s = configs.value.find((x) => x.id === id);
  bucket.value = s?.bucket || '';
  region.value = s?.region || 'cn-beijing';
  access.value = '';
  secret.value = '';
  message.value = '';
}
function current() {
  return configs.value.find((x) => x.id === selected.value);
}
async function load() {
  busy.value = true;
  error.value = '';
  try {
    const [s, p] = await Promise.all([
      request<State[]>('/admin/oss-service'),
      request<Progress>('/admin/oss-service/migration'),
    ]);
    if (!alive) return;
    configs.value = s;
    progress.value = p;
    if (!selected.value && s.length) choose(s[0]!.id);
  } catch (e) {
    if (alive) error.value = errorText(e);
  } finally {
    if (alive) busy.value = false;
  }
}
async function action(kind: string) {
  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    if (kind === 'save') {
      const s = await request<State>('/admin/oss-service', {
        method: 'POST',
        body: {
          id: selected.value || null,
          version: current()?.version || 0,
          bucket: bucket.value.trim(),
          region: region.value.trim(),
          accessKeyId: access.value.trim(),
          accessKeySecret: secret.value.trim(),
        },
      });
      if (!alive) return;
      selected.value = s.id;
      access.value = '';
      secret.value = '';
      message.value = '密钥已加密保存，请检查连接与安全配置。';
    } else {
      const s = current();
      if (!s) return;
      await request(`/admin/oss-service/${s.id}/${kind}`, { method: 'POST', version: s.version });
      message.value =
        kind === 'check'
          ? '检查已完成，请查看下方结果。'
          : kind === 'activate'
            ? '新上传已使用此OSS配置，历史文件位置保持不变。'
            : '已排队迁移可安全处理的文件，原文件保留。';
    }
    const [s, p] = await Promise.all([
      request<State[]>('/admin/oss-service'),
      request<Progress>('/admin/oss-service/migration'),
    ]);
    if (alive) {
      configs.value = s;
      progress.value = p;
    }
  } catch (e) {
    if (alive) error.value = errorText(e);
  } finally {
    if (alive) busy.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => {
  alive = false;
  access.value = '';
  secret.value = '';
});
</script>
<template>
  <section class="oss-page">
    <header>
      <div>
        <h1>文件存储</h1>
        <p class="muted">配置阿里云 OSS，让文件直接通过私有授权访问。</p>
      </div>
      <button class="button" :disabled="busy" @click="load">刷新状态</button>
    </header>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="message" role="status" class="success">{{ message }}</p>
    <div class="oss-grid">
      <form class="oss-card" @submit.prevent="action('save')">
        <h2>阿里云 OSS 配置</h2>
        <label
          >当前配置<AppSelect
            :model-value="selected"
            :options="[
              { value: '', label: '新增配置' },
              ...configs.map((s) => ({
                value: s.id,
                label: s.bucket + (s.defaultUpload ? ' · 默认上传' : ''),
              })),
            ]"
            @update:model-value="choose(String($event))"
            :disabled="busy"
        /></label>
        <div class="oss-fields">
          <label
            >Bucket<input
              v-model="bucket"
              required
              :disabled="busy || !!selected"
              pattern="[a-z0-9][a-z0-9-]{1,61}[a-z0-9]"
              placeholder="例如 zhixiang-private" /></label
          ><label
            >区域<input
              v-model="region"
              required
              :disabled="busy || !!selected"
              placeholder="cn-beijing"
          /></label>
        </div>
        <p class="muted">服务地址：https://oss-{{ region }}.aliyuncs.com</p>
        <label
          >AccessKey ID<input
            v-model="access"
            required
            autocomplete="off"
            :disabled="busy"
            :placeholder="
              current()?.accessTail
                ? '已保存 · 尾号 ' + current()?.accessTail + '；重新输入以更换'
                : 'RAM 子账号 AccessKey ID'
            "
            maxlength="128" /></label
        ><label
          >AccessKey Secret<input
            v-model="secret"
            type="password"
            required
            autocomplete="new-password"
            :disabled="busy"
            placeholder="只用于加密保存，不回显"
            maxlength="256"
        /></label>
        <p class="muted">
          使用仅授权此 Bucket 的 RAM 子账号。密钥不会返回浏览器，保存在服务端的加密凭证中。
        </p>
        <footer>
          <button
            class="button primary"
            :disabled="busy || !auth.permissions.includes('storages:write')"
          >
            保存配置</button
          ><button
            type="button"
            class="button"
            :disabled="busy || !selected || !auth.permissions.includes('storages:write')"
            @click="action('check')"
          >
            检查连接与安全配置
          </button>
        </footer>
      </form>
      <aside class="oss-card">
        <h2>访问保护</h2>
        <ul>
          <li>私有 Bucket 与阻止公共访问</li>
          <li>HTTPS 传输、OSS 托管 AES256 加密</li>
          <li>开启版本控制，固定下载文件版本</li>
          <li>每次下载先校验业务权限，签名 60 秒有效</li>
          <li>上传文件继续经过隔离扫描</li>
        </ul>
        <div class="oss-state">
          <strong>{{
            current()?.checkedAt
              ? current()?.checkError
                ? '检查未通过'
                : '安全检查已通过'
              : '尚未检查'
          }}</strong>
          <p v-if="current()?.checkError">
            {{
              current()?.checkError === 'OSS_SECURITY_REQUIRED'
                ? '请在阿里云开启以上私有、阻止公共访问、版本控制和加密设置。'
                : '请核对区域、密钥及 Bucket 读取权限。'
            }}
          </p>
          <p class="muted">
            只读检查不代表上传与跨域配置已通过。浏览器直传还需配置本站 Origin 的 CORS。
          </p>
        </div>
        <button
          class="button primary"
          :disabled="
            busy ||
            !current()?.checkedAt ||
            !!current()?.checkError ||
            current()?.defaultUpload ||
            !auth.permissions.includes('storages:write')
          "
          @click="action('activate')"
        >
          {{ current()?.defaultUpload ? '已用于新上传' : '用于新上传' }}
        </button>
      </aside>
    </div>
    <section class="oss-card oss-migration">
      <div>
        <h2>历史文件迁移</h2>
        <p>
          迁移会校验大小和 SHA256
          后切换文件位置，保留旧存储原件。视频衍生文件、隔离文件和历史导出需另行核查。
        </p>
      </div>
      <dl v-if="progress">
        <div>
          <dt>排队 / 执行中</dt>
          <dd>{{ progress.queued }} / {{ progress.running }}</dd>
        </div>
        <div>
          <dt>已校验迁移</dt>
          <dd>{{ progress.done }}</dd>
        </div>
        <div>
          <dt>失败待核查</dt>
          <dd>{{ progress.failed }}</dd>
        </div>
        <div>
          <dt>旧存储资产 / 导出</dt>
          <dd>{{ progress.remainingAssets }} / {{ progress.remainingExports }}</dd>
        </div>
      </dl>
      <p class="muted">
        旧存储保持运行，全部引用、备份与清理任务核对完成后才能停止。有效签名链接在到期前可被转发，请勿公开分享。
      </p>
      <button
        class="button"
        :disabled="
          busy ||
          !current()?.checkedAt ||
          !!current()?.checkError ||
          !auth.permissions.includes('storages:write')
        "
        @click="action('migrate')"
      >
        开始迁移到当前 OSS
      </button>
    </section>
  </section>
</template>
<style scoped>
.oss-page {
  max-width: 1120px;
  margin: auto;
}
.oss-page > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
}
.oss-page h1 {
  font-size: 22px;
  margin: 0 0 8px;
}
.oss-page h2 {
  font-size: 16px;
  margin: 0 0 20px;
}
.oss-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 20px;
}
.oss-card {
  padding: 24px;
  background: white;
  border: 1px solid #e4e8ef;
  border-radius: 10px;
}
.oss-card label {
  display: grid;
  gap: 8px;
  margin: 16px 0;
  font-size: 13px;
}
.oss-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.oss-fields input {
  width: 100%;
  min-width: 0;
}
.oss-card .muted {
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.oss-card footer {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 24px;
}
.oss-card ul {
  padding-left: 20px;
  font-size: 13px;
  line-height: 2.2;
  color: #56637a;
}
.oss-state {
  padding: 16px;
  background: #f7f8fc;
  border-radius: 8px;
  margin: 20px 0;
  font-size: 13px;
}
.oss-migration {
  margin-top: 20px;
  font-size: 13px;
  line-height: 1.8;
}
.oss-migration dl {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.oss-migration dt {
  font-size: 12px;
  color: #7e899a;
}
.oss-migration dd {
  margin: 5px 0;
  font-size: 22px;
  font-weight: 600;
}
@media (max-width: 800px) {
  .oss-grid,
  .oss-fields {
    grid-template-columns: 1fr;
  }
  .oss-card {
    padding: 18px;
  }
  .oss-migration dl {
    grid-template-columns: 1fr 1fr;
  }
  .oss-page > header {
    align-items: flex-start;
  }
}
</style>
