<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { createSHA256 } from 'hash-wasm';
import { auth, request, errorText } from '../api/client';
import type { Row } from '../types/api';
const props = defineProps<{
  ownerType: 'PROJECT' | 'KNOWLEDGE' | 'FORUM' | 'RECEIPT' | 'MATERIAL';
  ownerId: string;
  compact?: boolean;
}>();
const emit = defineEmits<{ ready: [Row]; busy: [boolean] }>();
const selected = ref<File>();
const filename = ref('');
const dragging = ref(false);
const localPreview = ref('');
function choose(file?: File) {
  if (!file || busy.value) return;
  if (localPreview.value) URL.revokeObjectURL(localPreview.value);
  selected.value = file;
  filename.value = file.name;
  error.value = '';
  message.value = '';
  asset.value = null;
  scanChecks = 0;
  localPreview.value = /^image\/(png|jpeg|gif|webp|avif)$/.test(file.type)
    ? URL.createObjectURL(file)
    : '';
}
function drop(event: DragEvent) {
  dragging.value = false;
  choose(event.dataTransfer?.files?.[0]);
}

const busy = ref(false),
  progress = ref(0),
  message = ref(''),
  error = ref(''),
  asset = ref<Row | null>(null);
watch(busy, (value) => emit('busy', value));
let activeUpload: XMLHttpRequest | undefined;
let scanChecks = 0;
let aborted = false,
  timer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value);
  aborted = true;
  clearTimeout(timer);
  activeUpload?.abort();
});
async function poll() {
  if (aborted || !asset.value?.id) return;
  try {
    asset.value = await request<Row>(`/${auth.platform}/assets/${asset.value.id}`);
    if (aborted) return;
    if (asset.value.state === 'READY') {
      message.value = '文件校验通过，可用于业务关联';
      busy.value = false;
      emit('ready', asset.value);
    } else if (asset.value.state === 'REJECTED') {
      message.value = '文件未通过安全校验，请更换文件';
      busy.value = false;
    } else {
      message.value = '文件已上传，等待校验与安全扫描';
      if (++scanChecks >= 20) {
        message.value = '文件已保存，扫描仍在排队，可稍后检查状态';
        busy.value = false;
      } else timer = setTimeout(poll, 3000);
    }
  } catch (e) {
    error.value = errorText(e);
    busy.value = false;
  }
}
async function upload() {
  const file = selected.value;
  if (!file || busy.value || !filename.value.trim() || !props.ownerId) return;
  if (asset.value && ['QUARANTINED', 'UPLOADING'].includes(String(asset.value.state))) {
    busy.value = true;
    scanChecks = 0;
    error.value = '';
    await poll();
    return;
  }
  if (file.size === 0) {
    error.value = '不能上传空文件';
    return;
  }
  if (file.size > 2147483648) {
    error.value = '文件不能超过2GB';
    return;
  }
  busy.value = true;
  error.value = '';
  message.value = '正在计算文件校验值';
  progress.value = 0;
  try {
    const hash = await createSHA256();
    hash.init();
    const chunk = 4 * 1024 * 1024;
    for (let offset = 0; offset < file.size; offset += chunk) {
      if (aborted) return;
      hash.update(new Uint8Array(await file.slice(offset, offset + chunk).arrayBuffer()));
      progress.value = Math.min(100, Math.round(((offset + chunk) / file.size) * 100));
    }
    const grant = await request<{
      uploadId: string;
      assetId: string;
      url: string;
      method: string;
      headers: Record<string, string>;
    }>(`/${auth.platform}/uploads`, {
      method: 'POST',
      body: {
        ownerType: props.ownerType,
        ownerId: props.ownerId,
        filename: filename.value.trim(),
        size: file.size,
        sha256: hash.digest(),
        mimeType: file.type || 'application/octet-stream',
      },
    });
    message.value = '正在上传文件';
    progress.value = 0;
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      activeUpload = xhr;
      xhr.open(grant.method, grant.url);
      for (const [key, value] of Object.entries(grant.headers)) {
        // 浏览器根据实际文件自动设置长度，禁止脚本手动设置该请求头。
        if (key.toLowerCase() !== 'content-length') xhr.setRequestHeader(key, value);
      }
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) progress.value = Math.round((e.loaded / e.total) * 100);
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error('对象存储上传失败，请重新上传'));
      xhr.onerror = () => reject(new Error('上传连接中断，请检查网络后重试'));
      xhr.onabort = () => reject(new Error('上传已取消'));
      xhr.onloadend = () => {
        activeUpload = undefined;
      };
      xhr.send(file);
    });
    asset.value = await request<Row>(`/${auth.platform}/uploads/${grant.uploadId}/complete`, {
      method: 'POST',
    });
    await poll();
  } catch (e) {
    error.value = errorText(e);
    busy.value = false;
  }
}
</script>
<template>
  <div class="upload" :class="{ 'upload-compact': compact }">
    <label
      class="drop-zone"
      :class="{ dragging, chosen: selected }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="drop"
    >
      <img v-if="localPreview" :src="localPreview" alt="所选文件预览" />
      <svg v-else viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M10 31v9h28v-9M24 32V8m-9 9 9-9 9 9"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <strong>{{
        selected ? selected.name : compact ? '点击选择文件' : '拖拽文件到这里，或点击选择'
      }}</strong>
      <span v-if="!compact">{{
        selected ? '点击可重新选择文件' : '图片、视频、文档及其他文件 · 最大2GB'
      }}</span>
      <input
        type="file"
        :disabled="busy"
        aria-label="选择上传文件"
        @change="choose(($event.target as HTMLInputElement).files?.[0])"
      />
    </label>
    <label v-if="selected && !compact" class="name-field"
      >文件名称<input
        v-model="filename"
        maxlength="200"
        :disabled="busy"
        aria-label="上传文件名称"
      /><small>可在上传前修改名称，请保留正确的文件扩展名。</small></label
    >
    <ol v-if="selected && !compact" class="upload-steps" aria-label="文件处理阶段">
      <li :class="{ active: busy && !asset }">上传文件</li>
      <li :class="{ active: asset && asset.state !== 'READY' }">安全检查</li>
      <li :class="{ active: asset?.state === 'READY' }">可使用</li>
    </ol>
    <div v-if="message" class="upload-status" role="status">
      <span :class="{ pulse: busy }"></span>{{ message }}
    </div>
    <progress
      v-if="busy"
      :value="message.includes('扫描') ? undefined : progress"
      max="100"
      :aria-label="message"
    />
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div v-if="!compact || selected" class="upload-footer">
      <small>文件通过安全扫描后才可关联使用</small
      ><button
        type="button"
        class="button primary"
        :disabled="busy || !selected || !filename.trim() || !ownerId || asset?.state === 'READY'"
        @click="upload"
      >
        {{
          busy
            ? '正在处理…'
            : asset?.state === 'READY'
              ? '可使用'
              : asset && ['QUARANTINED', 'UPLOADING'].includes(String(asset.state))
                ? '检查扫描状态'
                : '确认上传'
        }}
      </button>
    </div>
  </div>
</template>
<style scoped>
.upload {
  font-size: 13px;
}
.drop-zone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1.5px dashed #aac5ee;
  border-radius: 14px;
  min-height: 190px;
  padding: 24px;
  background: #f7faff;
  text-align: center;
  transition:
    background 0.2s,
    border-color 0.2s,
    transform 0.2s;
  overflow: hidden;
}
.drop-zone.dragging {
  background: #e9f2ff;
  border-color: #5793e8;
  transform: scale(1.01);
}
.drop-zone svg {
  width: 45px;
  height: 45px;
  color: #719ede;
}
.drop-zone img {
  height: 100px;
  max-width: 100%;
  object-fit: contain;
  border-radius: 8px;
}
.drop-zone strong {
  max-width: 100%;
  overflow-wrap: anywhere;
  color: #405679;
}
.drop-zone span,
.name-field small,
.upload-footer small {
  color: #8290a6;
  font-size: 12px;
}
.drop-zone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}
.drop-zone:focus-within {
  outline: 2px solid #83adeb;
  outline-offset: 3px;
}
.name-field {
  display: grid;
  gap: 8px;
  margin-top: 20px;
}
.upload-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-top: 24px;
}
.upload progress {
  width: 100%;
  height: 7px;
  accent-color: #75a5eb;
}
.upload-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
  color: #5674a0;
}
.pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #76a6ef;
  animation: pulse 1s ease-in-out infinite alternate;
}
@keyframes pulse {
  to {
    opacity: 0.3;
    transform: scale(0.7);
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
@media (max-width: 500px) {
  .upload-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>

<style scoped>
.upload-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  padding-left: 20px;
  color: #728095;
}
.upload-steps .active {
  color: #24559d;
  font-weight: 650;
}
</style>

<style scoped>
.upload-compact .drop-zone {
  min-height: 44px;
  flex-direction: row;
  gap: 9px;
  padding: 10px 12px;
  border-radius: 5px;
  background: #fcfdff;
  border: 1px dashed #cdd7e7;
  text-align: left;
  justify-content: flex-start;
  transform: none;
}
.upload-compact .drop-zone svg {
  width: 20px;
  height: 20px;
}
.upload-compact .drop-zone img {
  width: 28px;
  height: 28px;
  object-fit: cover;
}
.upload-compact .drop-zone strong {
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.upload-compact .upload-footer {
  margin-top: 7px;
  gap: 8px;
  flex-direction: row;
  align-items: center;
}
.upload-compact .upload-footer small {
  font-size: 10px;
}
.upload-compact .upload-footer .button {
  min-height: 28px;
  height: 28px;
  padding: 0 9px;
  font-size: 11px;
}
.upload-compact .upload-status {
  margin: 7px 0;
  font-size: 11px;
}
.upload-compact .error {
  font-size: 12px;
}
</style>
