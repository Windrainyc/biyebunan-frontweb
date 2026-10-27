<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { createSHA256 } from 'hash-wasm';
import { auth, request, errorText } from '../api/client';
import type { Row } from '../types/api';
const props = defineProps<{
  ownerType: 'PROJECT' | 'KNOWLEDGE' | 'FORUM' | 'RECEIPT';
  ownerId: string;
}>();
const emit = defineEmits<{ ready: [Row] }>();
const busy = ref(false),
  progress = ref(0),
  message = ref(''),
  error = ref(''),
  asset = ref<Row | null>(null);
let activeUpload: XMLHttpRequest | undefined;
let aborted = false,
  timer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => {
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
      timer = setTimeout(poll, 3000);
    }
  } catch (e) {
    error.value = errorText(e);
    busy.value = false;
  }
}
async function select(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
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
        filename: file.name,
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
      for (const [key, value] of Object.entries(grant.headers)) xhr.setRequestHeader(key, value);
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
  <div class="upload">
    <label>选择文件<input type="file" :disabled="busy" @change="select" /></label>
    <p v-if="message" role="status">{{ message }}</p>
    <progress v-if="busy" :value="progress" max="100" :aria-label="message" />
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p class="muted">上传后需通过校验与安全扫描，未通过前不能关联或下载。</p>
  </div>
</template>
<style scoped>
.upload {
  background: #f8f9fc;
  border: 1px dashed #b9c4db;
  border-radius: 10px;
  padding: 18px;
  font-size: 13px;
}
.upload label {
  display: grid;
  gap: 10px;
}
.upload progress {
  width: 100%;
}
</style>
