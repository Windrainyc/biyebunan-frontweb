<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { auth, request, errorText } from '../api/client';
import type { Page } from '../types/api';
import { display } from '../config/labels';
interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
const items = ref<Notification[]>([]),
  page = ref(1),
  total = ref(0),
  error = ref(''),
  busy = ref(false),
  failed = ref(false),
  reading = ref(new Set<string>());
let generation = 0;
async function load() {
  const current = ++generation;
  busy.value = true;
  failed.value = false;
  error.value = '';
  items.value = [];
  total.value = 0;
  try {
    const data = await request<Page<Notification>>(`/${auth.platform}/notifications`, {
      query: { page: page.value, size: 20 },
    });
    if (current !== generation) return;
    items.value = data.items;
    total.value = data.total;
  } catch (e) {
    if (current === generation) {
      failed.value = true;
      error.value = errorText(e);
    }
  } finally {
    if (current === generation) busy.value = false;
  }
}
async function read(item: Notification) {
  if (reading.value.has(item.id)) return;
  reading.value.add(item.id);
  error.value = '';
  try {
    await request(`/${auth.platform}/notifications/${item.id}/read`, { method: 'POST' });
    item.read = true;
  } catch (e) {
    error.value = errorText(e);
  } finally {
    reading.value.delete(item.id);
  }
}
onMounted(load);
</script>
<template>
  <section>
    <h1>消息通知</h1>
    <p class="muted">查看与你相关的项目与服务消息。</p>
    <button class="button" :disabled="busy" @click="load">
      {{ failed ? '重试查询' : '刷新' }}
    </button>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <article v-for="item in items" :key="item.id" class="notification">
      <div>
        <h2>{{ item.title }}</h2>
        <span>{{ display(item.createdAt) }}</span>
      </div>
      <p>{{ item.body }}</p>
      <button v-if="!item.read" class="button" :disabled="reading.has(item.id)" @click="read(item)">
        标记已读</button
      ><span v-else class="muted">已读</span>
    </article>
    <p v-if="!items.length" class="empty">
      {{ busy ? '加载中…' : failed ? '消息加载失败，请重试' : '暂无消息通知' }}
    </p>
    <div class="pagination">
      <span>{{ busy ? '正在查询…' : failed ? '总数暂不可用' : `共${total}条` }}</span
      ><button
        class="button"
        :disabled="page === 1 || busy"
        @click="
          page--;
          load();
        "
      >
        上一页</button
      ><span>第{{ page }}页</span
      ><button
        class="button"
        :disabled="page * 20 >= total || busy"
        @click="
          page++;
          load();
        "
      >
        下一页
      </button>
    </div>
  </section>
</template>
<style scoped>
.notification {
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 12px;
  padding: 24px;
  margin-top: 16px;
}
.notification > div {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
}
.notification h2 {
  font-size: 18px;
  margin: 0;
}
.notification span {
  font-size: 12px;
  color: #748096;
}
.notification p {
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
}
</style>
