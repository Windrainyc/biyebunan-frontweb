<script setup lang="ts">
import { useRoute } from 'vue-router';
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { auth, ApiError, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { events } from '../api/stream';
import type { Page, Row } from '../types/api';
interface Citation {
  sourceType: string;
  versionId: string;
  chunkId: string;
  page: number;
  quote: string;
}
function citations(message: Row): Citation[] {
  return Array.isArray(message.citations) ? (message.citations as Citation[]) : [];
}
const route = useRoute();
const source = ref(
  typeof route.query.source === 'string' && /^[0-9a-f-]{36}$/.test(route.query.source)
    ? route.query.source
    : '',
);
const sourceTitle = String(route.query.title || '已选知识资料').slice(0, 200);
const conversations = ref<Row[]>([]),
  projects = ref<Row[]>([]),
  models = ref<Row[]>([]),
  conversation = ref(''),
  project = ref(''),
  model = ref(''),
  text = ref(''),
  messages = ref<Row[]>([]),
  answer = ref(''),
  error = ref(''),
  busy = ref(false),
  disconnected = ref(false);
const run = ref<Row | null>(null),
  sequence = ref(0),
  pending = ref<{ key: string; body: Record<string, unknown> } | null>(null);
let controller: AbortController | undefined;
const conversationAttempt = writeAttempt();
const storageKey = () => `zx:active-run:${auth.user?.id}`;
async function resumeSaved() {
  const id = sessionStorage.getItem(storageKey());
  if (!id) return;
  try {
    run.value = await request<Row>(`/student/runs/${id}`);
    conversation.value = String(run.value.conversationId);
    await history();
    if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(String(run.value.state))) {
      sessionStorage.removeItem(storageKey());
      return;
    }
    busy.value = true;
    sequence.value = 0;
    await subscribe();
  } catch (e) {
    error.value = errorText(e);
  }
}
async function initialize() {
  try {
    const [c, p, m] = await Promise.all([
      request<Page<Row>>('/student/conversations', {
        query: { page: 1, size: 100 },
      }),
      request<Page<Row>>('/student/projects', {
        query: { page: 1, size: 100 },
      }),
      request<Page<Row>>('/student/models', { query: { page: 1, size: 100 } }),
    ]);
    conversations.value = c.items;
    projects.value = p.items;
    models.value = m.items;
    model.value = String(m.items[0]?.id || '');
    await resumeSaved();
  } catch (e) {
    error.value = errorText(e);
  }
}
async function history() {
  if (!conversation.value) return;
  try {
    const data = await request<Page<Row>>(`/student/conversations/${conversation.value}/messages`, {
      query: { page: 1, size: 100 },
    });
    messages.value = data.items;
  } catch (e) {
    error.value = errorText(e);
  }
}
async function subscribe() {
  if (!run.value?.id) return;
  controller?.abort();
  const activeController = new AbortController();
  controller = activeController;
  disconnected.value = false;
  let terminal = false;
  try {
    await events(run.value.id, sequence.value, activeController.signal, (event) => {
      sequence.value = event.sequence;
      if (event.type === 'delta') answer.value += event.data.text || '';
      if (['completed', 'failed', 'cancelled'].includes(event.type)) {
        terminal = true;
        if (event.type === 'failed') error.value = '本次答疑未完成，请查看用量账单中的结算状态。';
      }
    });
    if (terminal) {
      pending.value = null;
      sessionStorage.removeItem(storageKey());
      busy.value = false;
      await history();
      answer.value = '';
    } else disconnected.value = true;
  } catch (e) {
    if (!activeController.signal.aborted) {
      error.value = errorText(e);
      disconnected.value = true;
    }
  }
}
async function send() {
  if (busy.value && !pending.value) return;
  error.value = '';
  busy.value = true;
  try {
    if (!pending.value) {
      if (!text.value.trim() || !model.value) throw new Error('请选择可用模型并输入问题');
      if (!conversation.value) {
        if (!project.value) throw new Error('请先选择项目');
        const c = await request<Row>('/student/conversations', {
          method: 'POST',
          body: { projectId: project.value, title: text.value.slice(0, 40) },
          key: conversationAttempt({ projectId: project.value, title: text.value.slice(0, 40) }),
        });
        conversation.value = String(c.id);
        conversations.value.unshift(c);
      }
      pending.value = {
        key: crypto.randomUUID(),
        body: {
          conversationId: conversation.value,
          clientMessageId: crypto.randomUUID(),
          text: text.value,
          modelId: model.value,
          sourceVersionIds: source.value ? [source.value] : [],
          maxOutputTokens: Math.min(
            2048,
            Number(models.value.find((m) => m.id === model.value)?.maxOutputTokens || 2048),
          ),
        },
      };
    }
    run.value = await request<Row>('/student/runs', {
      method: 'POST',
      body: pending.value.body,
      key: pending.value.key,
    });
    sessionStorage.setItem(storageKey(), String(run.value.id));
    sequence.value = 0;
    answer.value = '';
    text.value = '';
    await history();
    await subscribe();
  } catch (e) {
    error.value = errorText(e);
    busy.value = false;
    // 明确的请求拒绝可修正内容；网络结果不明保留同一clientMessageId重试。
    if (e instanceof ApiError && [400, 403, 404, 409, 412, 422].includes(e.status))
      pending.value = null;
  }
}
async function cancel() {
  if (!run.value?.id) return;
  try {
    await request(`/student/runs/${run.value.id}/cancel`, {
      method: 'POST',
      body: { reason: '学生主动停止答疑' },
    });
  } catch (e) {
    error.value = errorText(e);
  }
}
onMounted(initialize);
onBeforeUnmount(() => controller?.abort());
</script>
<template>
  <section>
    <h1>在线智能答疑</h1>
    <p class="muted">围绕项目提问，回答与用量均会保存。关闭页面不会自动取消正在执行的答疑。</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="source" class="notice">
      本次引用：{{ sourceTitle
      }}<button class="button" :disabled="busy" @click="source = ''">移除引用</button>
    </p>
    <div class="chat-controls">
      <select v-model="conversation" :disabled="busy" aria-label="选择会话" @change="history">
        <option value="">新建会话</option>
        <option v-for="c in conversations" :key="String(c.id)" :value="c.id">
          {{ c.title }}
        </option></select
      ><select v-if="!conversation" v-model="project" aria-label="选择项目">
        <option value="">请选择项目</option>
        <option v-for="p in projects" :key="String(p.id)" :value="p.id">
          {{ p.title }}
        </option></select
      ><select v-model="model" :disabled="busy" aria-label="选择模型">
        <option value="">请选择可用模型</option>
        <option v-for="m in models" :key="String(m.id)" :value="m.id">
          {{ m.name }}
        </option>
      </select>
    </div>
    <p v-if="!models.length" class="notice">当前没有可用模型，请联系平台管理员配置。</p>
    <div class="messages">
      <article
        v-for="message in messages"
        :key="String(message.id)"
        :class="['message', message.role === 'USER' ? 'mine' : '']"
      >
        <strong>{{ message.role === 'USER' ? '我的提问' : '智能答疑' }}</strong>
        <p>{{ message.text }}</p>
        <details v-if="citations(message).length">
          <summary>查看回答引用（{{ citations(message).length }}）</summary>
          <blockquote v-for="citation in citations(message)" :key="citation.chunkId">
            <small
              >{{ citation.sourceType === 'KNOWLEDGE' ? '知识资料' : '项目交付' }} · 第{{
                citation.page
              }}页</small
            >
            <p>{{ citation.quote }}</p>
          </blockquote>
        </details>
      </article>
      <article v-if="answer" class="message">
        <strong>智能答疑</strong>
        <p>{{ answer }}</p>
      </article>
      <p v-if="!messages.length && !answer" class="empty">选择项目后，输入你的第一个问题。</p>
    </div>
    <div v-if="disconnected" class="notice">
      连接已中断，重新连接只获取已保存的回答，不会重新发起模型调用。<button
        class="button"
        @click="subscribe"
      >
        重新连接
      </button>
    </div>
    <form class="composer" @submit.prevent="send">
      <textarea
        v-model="text"
        rows="4"
        maxlength="16000"
        placeholder="描述你的问题、报错信息或需要解释的代码"
        :disabled="busy || !!pending"
      />
      <div>
        <span class="muted">{{ text.length }} / 16000</span
        ><button v-if="busy && run" type="button" class="button" @click="cancel">停止答疑</button
        ><button class="button primary" :disabled="busy || !models.length">
          {{ pending ? '重试同一次提问' : '发送问题' }}
        </button>
      </div>
    </form>
  </section>
</template>
<style scoped>
.chat-controls {
  display: flex;
  gap: 12px;
  margin: 24px 0;
  flex-wrap: wrap;
}
.messages {
  min-height: 280px;
  max-height: 50vh;
  overflow: auto;
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 12px;
  padding: 20px;
}
.message {
  background: #f5f7fb;
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 18px;
  max-width: 90%;
  font-size: 14px;
}
.message.mine {
  background: #edf2ff;
  margin-left: auto;
}
.message p {
  white-space: pre-wrap;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.composer {
  margin-top: 20px;
}
.composer textarea {
  width: 100%;
}
.composer > div {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
