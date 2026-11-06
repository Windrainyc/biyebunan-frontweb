<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { request, errorText } from '../api/client';
import type { Page, Row } from '../types/api';
const props = defineProps<{
  selected: { versionId: string; title: string }[];
  disabled?: boolean;
}>();
const emit = defineEmits<{ change: [value: { versionId: string; title: string }[]] }>();
const q = ref(''),
  items = ref<Row[]>([]),
  error = ref(''),
  busy = ref(false),
  searched = ref(false),
  page = ref(1),
  total = ref(0);
let generation = 0;
onBeforeUnmount(() => generation++);
async function search(reset = true) {
  if (reset) page.value = 1;
  const g = ++generation;
  busy.value = true;
  error.value = '';
  items.value = [];
  try {
    const r = await request<Page<Row>>('/student/knowledge-search', {
      query: { q: q.value.trim(), mode: 'KEYWORD', page: page.value, size: 8 },
    });
    if (g !== generation) return;
    items.value = r.items;
    total.value = r.total;
    searched.value = true;
  } catch (e) {
    if (g === generation) error.value = errorText(e);
  } finally {
    if (g === generation) busy.value = false;
  }
}
function toggle(hit: Row) {
  const id = String(hit.versionId);
  if (props.selected.some((x) => x.versionId === id))
    emit(
      'change',
      props.selected.filter((x) => x.versionId !== id),
    );
  else if (props.selected.length < 8)
    emit('change', [...props.selected, { versionId: id, title: String(hit.title) }]);
}
</script>
<template>
  <section class="knowledge-picker">
    <h3>引用知识资料</h3>
    <p class="muted">仅显示你有权查看的已发布知识，最多选择8份。</p>
    <form @submit.prevent="search()">
      <input
        v-model="q"
        maxlength="100"
        required
        placeholder="输入知识关键词"
        aria-label="检索引用资料"
      /><button class="button" :disabled="busy || disabled">检索</button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="busy" role="status">正在检索…</p>
    <article v-for="hit in items" :key="String(hit.versionId)">
      <label
        ><input
          type="checkbox"
          :checked="selected.some((x) => x.versionId === String(hit.versionId))"
          :disabled="
            disabled ||
            (!selected.some((x) => x.versionId === String(hit.versionId)) && selected.length >= 8)
          "
          @change="toggle(hit)"
        />{{ hit.title }}</label
      >
      <p>{{ hit.snippet }}</p>
      <RouterLink :to="{ path: '/student/knowledge', query: { view: String(hit.contentId) } }"
        >查看原文</RouterLink
      >
    </article>
    <p v-if="searched && !busy && !items.length" class="muted">
      没有找到可引用的资料，请调整关键词。
    </p>
    <div v-if="total > 8" class="pagination">
      <button
        class="button"
        :disabled="busy || page <= 1"
        @click="
          page--;
          search(false);
        "
      >
        上一页</button
      ><span>{{ page }}页</span
      ><button
        class="button"
        :disabled="busy || page * 8 >= total"
        @click="
          page++;
          search(false);
        "
      >
        下一页
      </button>
    </div>
  </section>
</template>
<style scoped>
.knowledge-picker form {
  display: flex;
  gap: 8px;
}
.knowledge-picker input:not([type='checkbox']) {
  min-width: 0;
  flex: 1;
}
.knowledge-picker article {
  padding: 14px 0;
  border-bottom: 1px solid #e5e9ef;
}
.knowledge-picker label {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.knowledge-picker p {
  font-size: 12px;
  color: #788398;
  line-height: 1.8;
}
.knowledge-picker a {
  font-size: 12px;
}
.knowledge-picker h3 {
  font-size: 15px;
}
</style>
