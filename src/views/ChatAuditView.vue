<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { request, errorText } from '../api/client';
import type { Row, Page } from '../types/api';
import { display } from '../config/labels';
const reason = ref(''),
  query = ref(''),
  items = ref<Row[]>([]),
  page = ref(1),
  total = ref(0),
  selected = ref<Row | null>(null),
  messages = ref<Row[]>([]),
  messagePage = ref(1),
  messageTotal = ref(0),
  error = ref(''),
  busy = ref(false);
const reading = ref(false);
let listGeneration = 0,
  messageGeneration = 0;
onBeforeUnmount(() => {
  listGeneration++;
  messageGeneration++;
});
async function list() {
  if (!reason.value.trim()) return;
  const current = ++listGeneration;
  messageGeneration++;
  reading.value = false;
  busy.value = true;
  error.value = '';
  selected.value = null;
  messages.value = [];
  try {
    const data = await request<Page<Row>>('/admin/conversations', {
      query: { page: page.value, size: 20, q: query.value, reason: reason.value },
    });
    if (current !== listGeneration) return;
    items.value = data.items;
    total.value = data.total;
  } catch (e) {
    if (current === listGeneration) error.value = errorText(e);
  } finally {
    if (current === listGeneration) busy.value = false;
  }
}
async function inspect(row: Row) {
  if (!reason.value.trim()) return;
  const current = ++messageGeneration;
  selected.value = row;
  messages.value = [];
  error.value = '';
  reading.value = true;
  try {
    const data = await request<Page<Row>>(`/admin/conversations/${row.id}/messages`, {
      query: { page: messagePage.value, size: 20, sort: 'createdAt:asc', reason: reason.value },
    });
    if (current !== messageGeneration) return;
    messages.value = data.items;
    messageTotal.value = data.total;
  } catch (e) {
    if (current === messageGeneration) error.value = errorText(e);
  } finally {
    if (current === messageGeneration) reading.value = false;
  }
}
</script>
<template>
  <section>
    <h1>答疑会话审计</h1>
    <p class="notice">
      学生私聊仅限获授权管理员因明确业务原因查阅。每次查询与阅读都会留下审计记录，项目中介无权访问。
    </p>
    <form
      class="audit-form"
      @submit.prevent="
        page = 1;
        list();
      "
    >
      <label>查阅原因<textarea v-model="reason" maxlength="1000" rows="2" required /></label
      ><label>会话关键词<input v-model="query" maxlength="100" /></label
      ><button class="button primary" :disabled="busy">查询会话</button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="audit-grid">
      <section>
        <article v-for="item in items" :key="String(item.id)">
          <h3>{{ item.title }}</h3>
          <p>{{ display(item.createdAt) }}</p>
          <button
            class="button"
            :disabled="busy || !reason.trim()"
            @click="
              messagePage = 1;
              inspect(item);
            "
          >
            查看消息
          </button>
        </article>
        <div class="pagination">
          <button
            class="button"
            :disabled="busy || page === 1"
            @click="
              page--;
              list();
            "
          >
            上一页</button
          ><span>共{{ total }}条</span
          ><button
            class="button"
            :disabled="busy || page * 20 >= total"
            @click="
              page++;
              list();
            "
          >
            下一页
          </button>
        </div>
      </section>
      <section v-if="selected">
        <h2>{{ selected.title }}</h2>
        <article v-for="message in messages" :key="String(message.id)">
          <strong>{{ message.role === 'USER' ? '学生提问' : '智能答疑' }}</strong>
          <p class="prose">{{ message.text }}</p>
          <span>{{ display(message.createdAt) }}</span>
        </article>
        <div class="pagination">
          <button
            class="button"
            :disabled="reading || messagePage === 1"
            @click="
              messagePage--;
              inspect(selected);
            "
          >
            上一页</button
          ><span>共{{ messageTotal }}条</span
          ><button
            class="button"
            :disabled="reading || messagePage * 20 >= messageTotal"
            @click="
              messagePage++;
              inspect(selected);
            "
          >
            下一页
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
<style scoped>
.audit-form {
  display: grid;
  gap: 16px;
  max-width: 700px;
  margin: 24px 0;
}
.audit-form label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
.audit-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 20px;
}
.audit-grid article {
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 12px;
}
.audit-grid h3 {
  margin-top: 0;
}
.audit-grid span,
.audit-grid article > p:not(.prose) {
  font-size: 12px;
  color: #748096;
}
</style>
