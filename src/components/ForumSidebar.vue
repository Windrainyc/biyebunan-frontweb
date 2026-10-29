<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { request, errorText } from '../api/client';
import type { Row, Page } from '../types/api';
import Icon from './Icon.vue';
defineProps<{ modelValue: unknown }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();
const boards = ref<Row[]>([]),
  page = ref(0),
  total = ref(0),
  loading = ref(false),
  error = ref('');
let disposed = false;
async function load() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await request<Page<Row>>('/student/dictionaries/forum-boards', {
      query: { page: page.value + 1, size: 20 },
    });
    if (disposed) return;
    boards.value = [
      ...new Map([...boards.value, ...result.items].map((row) => [row.id, row])).values(),
    ];
    page.value++;
    total.value = result.total;
  } catch (e) {
    if (!disposed) error.value = errorText(e);
  } finally {
    if (!disposed) loading.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => {
  disposed = true;
});
</script>
<template>
  <aside class="forum-side-panels">
    <section class="forum-side-panel">
      <h2><Icon name="message" />讨论板块</h2>
      <nav aria-label="论坛板块">
        <button
          :aria-pressed="!modelValue"
          :class="{ active: !modelValue }"
          @click="emit('update:modelValue', '')"
        >
          全部讨论<Icon name="right" /></button
        ><button
          v-for="board in boards"
          :key="String(board.id)"
          :aria-pressed="modelValue === board.id"
          :class="{ active: modelValue === board.id }"
          @click="emit('update:modelValue', String(board.id))"
        >
          {{ board.name }}<Icon name="right" />
        </button>
      </nav>
      <p v-if="error" class="error" role="alert">
        {{ error }}<button class="text-button" @click="load">重试板块</button>
      </p>
      <p v-if="loading" class="muted" role="status">正在读取板块…</p>
      <button v-if="boards.length < total" class="text-button" :disabled="loading" @click="load">
        加载更多板块
      </button>
    </section>
    <section class="forum-side-panel forum-search-note">
      <p class="eyebrow">提问小提示</p>
      <h3>提问前，先试试搜索</h3>
      <p>把问题发生的步骤、报错信息和已经尝试的方法写清楚，让交流更有效。</p>
      <RouterLink to="/student/knowledge">去知识库找答案 <Icon name="right" /></RouterLink>
    </section>
    <section class="forum-side-panel">
      <Icon name="sparkles" />
      <h3>围绕你的项目深入交流</h3>
      <p>进入智能答疑，选择项目和可用模型，继续梳理具体问题。</p>
      <RouterLink to="/student/chat">打开智能答疑 <Icon name="right" /></RouterLink>
    </section>
  </aside>
</template>
<style scoped>
.forum-side-panels {
  display: grid;
  gap: 18px;
}
.forum-side-panel {
  padding: 22px;
  border: 1px solid #e5e9f1;
  border-radius: 14px;
  background: white;
}
h2 {
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 16px;
}
h3 {
  font-size: 16px;
  color: #293c58;
  margin: 12px 0;
}
p {
  font-size: 12px;
  line-height: 1.8;
  color: #8a95a8;
}
nav {
  display: grid;
  gap: 4px;
}
nav button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #6b7a93;
  font-size: 12px;
  padding: 10px 12px;
  text-align: left;
}
nav button.active {
  background: #edf1fd;
  color: #334bb8;
}
a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #425ac0;
  font-size: 12px;
}
.forum-search-note {
  background: #fbf5eb;
  border-color: #eee3d2;
}
.forum-search-note .eyebrow {
  color: #a17c50;
}
@media (max-width: 900px) {
  .forum-side-panels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .forum-side-panel:first-child {
    grid-column: 1/-1;
  }
  .forum-side-panel nav {
    display: flex;
    flex-wrap: wrap;
  }
}
@media (max-width: 520px) {
  .forum-side-panels {
    grid-template-columns: 1fr;
  }
}
</style>
