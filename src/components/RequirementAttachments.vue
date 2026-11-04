<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { auth, request, errorText } from '../api/client';
const props = defineProps<{ ids: unknown }>();
const files = ref<{ id: string; name: string }[]>([]),
  error = ref(''),
  link = ref<{ id: string; url: string } | null>(null),
  busy = ref('');
let generation = 0,
  timer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.ids,
  async (value) => {
    const current = ++generation;
    link.value = null;
    clearTimeout(timer);
    const ids = Array.isArray(value) ? value.map(String) : [];
    files.value = ids.map((id, index) => ({ id, name: `需求附件 ${index + 1}` }));
    if (auth.platform === 'partner') return;
    const names = await Promise.all(
      ids.map(async (id, index) => {
        try {
          const asset = await request<{ filename: string }>(`/${auth.platform}/assets/${id}`);
          return { id, name: asset.filename };
        } catch {
          return { id, name: `需求附件 ${index + 1}（暂无法读取）` };
        }
      }),
    );
    if (current === generation) files.value = names;
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
  clearTimeout(timer);
});
async function download(id: string) {
  const current = generation;
  error.value = '';
  busy.value = id;
  link.value = null;
  clearTimeout(timer);
  try {
    const grant = await request<{ url: string; expiresAt: string }>(
      `/${auth.platform}/assets/${id}/download`,
      { method: 'POST' },
    );
    if (current !== generation) return;
    const url = new URL(grant.url),
      remaining = Date.parse(grant.expiresAt) - Date.now();
    if (!['http:', 'https:'].includes(url.protocol) || !(remaining > 0))
      throw Error('下载授权无效，请重试');
    link.value = { id, url: url.href };
    timer = setTimeout(() => (link.value = null), remaining);
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) busy.value = '';
  }
}
</script>
<template>
  <section v-if="files.length" class="requirement-attachments">
    <h3>需求附件</h3>
    <p v-if="auth.platform === 'partner'" class="muted">
      共 {{ files.length }} 个附件，文件由管理员和项目学生查看。
    </p>
    <ul v-else>
      <li v-for="file in files" :key="file.id">
        <span>{{ file.name }}</span
        ><button type="button" class="button" :disabled="!!busy" @click="download(file.id)">
          {{ busy === file.id ? '获取中…' : '下载' }}</button
        ><a
          v-if="link?.id === file.id"
          class="button primary"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          >打开文件</a
        >
      </li>
    </ul>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>
<style scoped>
h3 {
  font-size: 14px;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}
li {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px;
  border: 1px solid #e2eaf4;
  border-radius: 8px;
}
li span {
  flex: 1;
  min-width: 120px;
  overflow-wrap: anywhere;
}
li .button {
  min-height: 30px;
  padding: 4px 10px;
  font-size: 12px;
}
</style>
