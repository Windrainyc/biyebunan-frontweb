<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { display } from '../config/labels';
import type { Row, Page } from '../types/api';
import AssetUpload from './AssetUpload.vue';
const props = defineProps<{ post: Row }>(),
  emit = defineEmits<{ changed: [] }>();
const comments = ref<Row[]>([]),
  page = ref(1),
  total = ref(0),
  body = ref(''),
  parent = ref<Row | null>(null),
  error = ref(''),
  busy = ref(false);
const attempt = writeAttempt();
const loading = ref(false);
let generation = 0;
async function load() {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const data = await request<Page<Row>>(`/${auth.platform}/posts/${props.post.id}/comments`, {
      query: { page: page.value, size: 20 },
    });
    if (current !== generation) return;
    comments.value = data.items;
    total.value = data.total;
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) loading.value = false;
  }
}
async function send() {
  busy.value = true;
  try {
    const data = { body: body.value, parentId: parent.value?.id || null };
    await request(`/student/posts/${props.post.id}/comments`, {
      method: 'POST',
      body: data,
      key: attempt(data),
    });
    body.value = '';
    parent.value = null;
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function attach(asset: Row) {
  busy.value = true;
  try {
    const current = await request<Row>(`/student/posts/${props.post.id}`);
    const data = {
      boardId: current.boardId,
      title: current.title,
      body: current.body,
      tagIds: current.tagIds,
      assetIds: [...(current.assetIds as string[]), asset.id],
    };
    await request(`/student/posts/${props.post.id}`, {
      method: 'PUT',
      body: data,
      version: current.version,
      key: attempt(data),
    });
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
watch(
  () => props.post.id,
  () => {
    page.value = 1;
    void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => generation++);
</script>
<template>
  <section>
    <h3>交流回复</h3>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <article v-for="comment in comments" :key="String(comment.id)" class="comment">
      <span
        >{{ comment.authorId === auth.user?.id ? '我的回复' : '社区成员' }} ·
        {{ display(comment.createdAt) }}</span
      >
      <p>{{ comment.body }}</p>
      <button
        v-if="auth.platform === 'student' && !comment.parentId"
        class="button"
        @click="parent = comment"
      >
        回复
      </button>
    </article>
    <p v-if="!comments.length" class="muted">暂无回复</p>
    <div class="pagination">
      <button
        class="button"
        :disabled="loading || busy || page === 1"
        @click="
          page--;
          load();
        "
      >
        上一页</button
      ><span>第{{ page }}页 · 共{{ total }}条</span
      ><button
        class="button"
        :disabled="loading || busy || page * 20 >= total"
        @click="
          page++;
          load();
        "
      >
        下一页
      </button>
    </div>
    <form v-if="auth.platform === 'student' && post.state === 'PUBLISHED'" @submit.prevent="send">
      <p v-if="parent" class="notice">
        回复：{{ String(parent.body).slice(0, 80)
        }}<button type="button" class="button" @click="parent = null">取消回复</button>
      </p>
      <textarea
        v-model="body"
        rows="4"
        maxlength="5000"
        required
        placeholder="写下你的思路或补充信息"
      /><button class="button primary" :disabled="busy">发表回复</button>
    </form>
    <template
      v-if="
        auth.platform === 'student' &&
        post.authorId === auth.user?.id &&
        ['PENDING', 'PUBLISHED'].includes(String(post.state))
      "
      ><h3>补充附件</h3>
      <AssetUpload owner-type="FORUM" :owner-id="String(post.id)" @ready="attach"
    /></template>
  </section>
</template>
<style scoped>
.comment {
  padding: 16px;
  border-bottom: 1px solid #e2e6ef;
  font-size: 14px;
}
.comment span {
  font-size: 12px;
  color: #748096;
}
.comment p {
  white-space: pre-wrap;
  line-height: 1.8;
}
form {
  display: grid;
  gap: 14px;
}
</style>
