<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { display } from '../config/labels';
import type { Row, Page } from '../types/api';
import AssetUpload from './AssetUpload.vue';
import RecordActions from './RecordActions.vue';
import MarkdownContent from './MarkdownContent.vue';
const props = defineProps<{ post: Row }>(),
  emit = defineEmits<{ changed: []; replied: [] }>();
const comments = ref<Row[]>([]),
  page = ref(1),
  total = ref(0),
  body = ref(''),
  parent = ref<Row | null>(null),
  error = ref(''),
  busy = ref(false);
const emojiOpen = ref(false);
const emojis = [
  '😀',
  '😊',
  '😄',
  '🥳',
  '😎',
  '🤔',
  '😂',
  '🥹',
  '😭',
  '😅',
  '👍',
  '👏',
  '🙌',
  '🤝',
  '🙏',
  '💪',
  '❤️',
  '💜',
  '🎉',
  '✨',
  '🔥',
  '💡',
  '📚',
  '🎓',
  '✅',
  '👀',
  '🚀',
  '🌟',
  '💯',
  '☕',
];
async function insertEmoji(emoji: string) {
  const input = replyInput.value;
  const start = input?.selectionStart ?? body.value.length;
  const end = input?.selectionEnd ?? start;
  if (body.value.length - (end - start) + emoji.length > 5000) return;
  body.value = body.value.slice(0, start) + emoji + body.value.slice(end);
  await nextTick();
  input?.focus();
  input?.setSelectionRange(start + emoji.length, start + emoji.length);
}
const threadedComments = computed(() => {
  const rows = comments.value;
  const roots = rows.filter((c) => !c.parentId);
  const children = (id: unknown) =>
    rows
      .filter((c) => c.parentId === id)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const result: Row[] = [];
  for (const root of roots) result.push(root, ...children(root.id));
  for (const child of rows.filter((c) => c.parentId && !rows.some((p) => p.id === c.parentId)))
    result.push(child);
  return result;
});
const attempt = writeAttempt();
const deleting = ref<Row | null>(null);
const replyInput = ref<HTMLTextAreaElement | null>(null);
const notice = ref('');
function reply(comment: Row) {
  parent.value = comment;
  void nextTick(() => replyInput.value?.focus());
}
async function removeComment() {
  if (!deleting.value || busy.value) return;
  busy.value = true;
  const selected = deleting.value;
  try {
    await request(`/student/comments/${selected.id}`, {
      method: 'DELETE',
      version: selected.version,
      key: attempt({ delete: selected.id, version: selected.version }),
    });
    deleting.value = null;
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
const attachments = computed(() =>
  ((props.post.assetIds as string[] | undefined) || []).filter(
    (id) => !String(props.post.body).includes('[[asset:' + id + ']]'),
  ),
);
const downloadGrant = ref<{ id: string; url: string } | null>(null);
let downloadGeneration = 0;
let downloadTimer: ReturnType<typeof setTimeout> | undefined;
function clearDownload() {
  downloadGeneration++;
  clearTimeout(downloadTimer);
  downloadGrant.value = null;
}
async function download(id: string) {
  clearDownload();
  error.value = '';
  const current = downloadGeneration;
  try {
    const grant = await request<{ url: string; expiresAt: string }>(
      `/${auth.platform}/assets/${id}/download`,
      { method: 'POST' },
    );
    if (current !== downloadGeneration) return;
    const url = new URL(grant.url);
    const remaining = Date.parse(grant.expiresAt) - Date.now();
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !Number.isFinite(remaining) ||
      remaining <= 0
    )
      throw new Error('下载授权无效或已过期，请重新获取');
    downloadGrant.value = { id, url: url.toString() };
    downloadTimer = setTimeout(clearDownload, remaining);
  } catch (e) {
    if (current === downloadGeneration) error.value = errorText(e);
  }
}
const loading = ref(false);
const readError = ref('');
let generation = 0;
async function load() {
  const current = ++generation;
  loading.value = true;
  readError.value = '';
  comments.value = [];
  total.value = 0;
  try {
    const data = await request<Page<Row>>(`/${auth.platform}/posts/${props.post.id}/comments`, {
      query: { page: page.value, size: 20 },
    });
    if (current !== generation) return;
    comments.value = data.items;
    total.value = data.total;
    if (page.value > Math.max(1, Math.ceil(data.total / 20))) {
      page.value = Math.max(1, Math.ceil(data.total / 20));
      await load();
    }
  } catch (e) {
    if (current === generation) readError.value = errorText(e);
  } finally {
    if (current === generation) loading.value = false;
  }
}
async function send() {
  if (busy.value || !body.value.trim()) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const data = { body: body.value, parentId: parent.value?.id || null };
    await request(`/student/posts/${props.post.id}/comments`, {
      method: 'POST',
      body: data,
      key: attempt(data),
    });
    body.value = '';
    parent.value = null;
    notice.value = '回复已提交';
    await load();
    emit('replied');
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
    body.value = '';
    parent.value = null;
    deleting.value = null;
    comments.value = [];
    clearDownload();
    void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
  clearDownload();
});
</script>
<template>
  <section class="forum-replies">
    <template v-if="attachments.length">
      <h3>帖子附件</h3>
      <div v-for="(id, index) in attachments" :key="id" class="comment">
        <span>附件 {{ index + 1 }}</span>
        <button class="button" @click="download(id)">下载附件 {{ index + 1 }}</button>
        <a
          v-if="downloadGrant?.id === id"
          class="button primary"
          :href="downloadGrant.url"
          rel="noreferrer"
          >保存已授权附件</a
        >
      </div>
    </template>
    <h3 class="discussion-heading">
      评论 <small v-if="!loading && !readError">{{ total }} 条</small>
    </h3>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="readError" class="error" role="alert">
      {{ readError }} <button class="button" :disabled="loading" @click="load">重试读取回复</button>
    </p>
    <p v-if="loading" class="muted" role="status">正在读取回复…</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <article
      v-for="comment in threadedComments"
      :key="String(comment.id)"
      class="comment"
      :class="{ 'comment-child': !!comment.parentId }"
    >
      <span
        >{{ comment.authorId === auth.user?.id ? '我的回复' : '社区成员' }} ·
        {{ display(comment.createdAt) }}</span
      >
      <small v-if="comment.parentId" class="reply-context"
        >↳ 回复{{
          comments.some((p) => p.id === comment.parentId) ? '上方评论' : '另一页的评论'
        }}</small
      >
      <MarkdownContent :text="String(comment.body || '')" />
      <span v-if="comment.state !== 'PUBLISHED' && comment.state !== 'VISIBLE'">{{
        display(comment.state)
      }}</span>
      <RecordActions
        v-if="auth.platform === 'admin'"
        resource-key="comments"
        :record="comment"
        @changed="load"
      />
      <button
        v-if="auth.platform === 'student' && comment.authorId === auth.user?.id"
        class="comment-action danger"
        :disabled="busy"
        @click="deleting = comment"
      >
        删除
      </button>
      <button
        v-if="auth.platform === 'student' && post.state === 'PUBLISHED' && !comment.parentId"
        class="comment-action"
        @click="reply(comment)"
      >
        回复
      </button>
    </article>
    <div v-if="deleting" class="notice" role="alert">
      <p>确认删除这条回复？删除后将不再展示，操作会记录审计。</p>
      <button class="button" :disabled="busy" @click="removeComment">确认删除回复</button>
      <button class="button" :disabled="busy" @click="deleting = null">取消删除</button>
    </div>
    <p v-if="!loading && !readError && !comments.length" class="muted">
      暂无回复，分享你的思路吧。
    </p>
    <div v-if="total > 20" class="pagination">
      <button
        class="button"
        :disabled="loading || busy || !!readError || page === 1"
        @click="
          page--;
          load();
        "
      >
        上一页</button
      ><span>第{{ page }}页 · 共{{ total }}条</span
      ><button
        class="button"
        :disabled="loading || busy || !!readError || page * 20 >= total"
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
        ref="replyInput"
        v-model="body"
        rows="2"
        maxlength="5000"
        required
        aria-label="回复正文"
        placeholder="写下你的思路或补充信息"
      />
      <div class="emoji-picker" @keydown.esc="emojiOpen = false">
        <button
          type="button"
          class="emoji-toggle"
          :aria-expanded="emojiOpen"
          aria-label="选择表情"
          @click="emojiOpen = !emojiOpen"
        >
          ☺ <span>表情</span>
        </button>
        <div v-if="emojiOpen" class="emoji-grid" role="group" aria-label="常用表情">
          <button
            v-for="emoji in emojis"
            :key="emoji"
            type="button"
            :aria-label="`插入${emoji}`"
            @mousedown.prevent
            @click="insertEmoji(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>
      <div class="reply-submit">
        <span>{{ body.length }} / 5000</span
        ><button class="button primary" :disabled="busy || !body.trim()">
          {{ busy ? '提交中…' : '发表回复' }}
        </button>
      </div>
    </form>
  </section>
</template>
<style scoped>
h3 {
  margin-top: 28px;
  font-size: 16px;
}
h3 small {
  font-size: 12px;
  font-weight: 400;
  color: #8a96ab;
  margin-left: 8px;
}
.reply-submit {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: #8a96ab;
}
.forum-attachments-editor {
  border-top: 1px solid #e5eaf2;
  margin-top: 24px;
  padding-top: 18px;
}
.forum-attachments-editor summary {
  cursor: pointer;
  font-size: 13px;
  color: #5b6e8c;
  margin-bottom: 14px;
}
.comment .button {
  margin: 8px 8px 0 0;
  padding: 6px 10px;
  min-height: 30px;
  font-size: 12px;
}
.pagination {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  margin: 20px 0;
  color: #8290a5;
}
.comment {
  padding: 14px 0;
  border-bottom: 1px solid #e2e6ef;
  font-size: 14px;
}
.comment span {
  font-size: 12px;
  color: #748096;
}
.comment-child {
  margin-left: 28px;
  padding: 12px 16px;
  background: #f8f7fc;
  border-left: 2px solid #e3ddf3;
  border-bottom: 0;
  border-radius: 0 8px 8px 0;
  margin-bottom: 8px;
}
.reply-context {
  display: block;
  color: #9690a8;
  font-size: 11px;
  margin-top: 5px;
}
.comment :deep(.reading-prose p) {
  margin: 6px 0;
  line-height: 1.65;
}
.comment :deep(.reading-prose) {
  margin: 0;
}
.comment p {
  white-space: pre-wrap;
  line-height: 1.8;
}
form {
  display: grid;
  gap: 10px;
}
.emoji-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: #827b96;
  font-size: 20px;
  cursor: pointer;
}
.emoji-toggle span {
  font-size: 12px;
}
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 4px;
  margin-top: 8px;
  padding: 10px;
  background: white;
  border: 1px solid #ece8f4;
  border-radius: 10px;
  max-width: 400px;
}
.emoji-grid button {
  border: 0;
  background: transparent;
  font-size: 22px;
  padding: 5px;
  min-width: 0;
  cursor: pointer;
  border-radius: 6px;
}
.emoji-grid button:hover {
  background: #f0ecff;
}
@media (max-width: 600px) {
  .emoji-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
.forum-replies {
  border-top: 1px solid #eeedf4;
  padding-top: 22px;
}
.discussion-heading {
  margin: 0 0 18px;
  font-size: 17px;
}
.comment-action {
  border: 0;
  background: transparent;
  color: #817a9b;
  font-size: 12px;
  min-height: 28px;
  padding: 3px 0;
  margin: 8px 18px 0 0;
  box-shadow: none;
  cursor: pointer;
}
.comment-action:hover {
  color: #6854dc;
}
.comment-action.danger:hover {
  color: #c65365;
}
.forum-replies form {
  margin-top: 22px;
  padding: 14px;
  border: 1px solid #e7e4f0;
  border-radius: 12px;
  background: #faf9fd;
}
.forum-replies form:focus-within {
  border-color: #a89ae7;
}
.forum-replies textarea {
  min-height: 52px;
  padding: 4px;
  border: 0;
  border-radius: 0;
  background: transparent;
  resize: vertical;
  font: inherit;
  font-size: 14px;
  line-height: 1.7;
  box-shadow: none;
}
.forum-replies textarea:focus {
  outline: none;
  box-shadow: none;
}
.reply-submit .primary {
  min-height: 34px;
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
}
.reply-submit .primary:disabled {
  opacity: 0.5;
}
.forum-replies > .muted {
  padding: 12px 0;
  font-size: 13px;
  color: #9691a5;
}
@media (max-width: 600px) {
  .forum-replies {
    padding-top: 18px;
  }
  .forum-replies form {
    padding: 12px;
  }
}
</style>
