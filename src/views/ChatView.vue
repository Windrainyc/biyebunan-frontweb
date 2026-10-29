<script setup lang="ts">
import { useRoute } from 'vue-router';
import Icon from '../components/Icon.vue';
import { display } from '../config/labels';
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { auth, ApiError, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { events } from '../api/stream';
import { useConversationHistory } from '../composables/useConversationHistory';
import MarkdownContent from '../components/MarkdownContent.vue';
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
  answer = ref(''),
  error = ref(''),
  busy = ref(false),
  disconnected = ref(false);
const conversationSearch = ref('');
const conversationListOpen = ref(false);
const filteredConversations = computed(() =>
  conversations.value.filter((c) => String(c.title).includes(conversationSearch.value)),
);
const contextProject = computed(() =>
  projects.value.find(
    (p) =>
      String(p.id) ===
      String(
        conversations.value.find((c) => String(c.id) === conversation.value)?.projectId ||
          project.value,
      ),
  ),
);
async function chooseConversation(id: string) {
  if (busy.value || pending.value) return;
  conversationListOpen.value = false;
  conversation.value = id;
  answer.value = '';
  disconnected.value = false;
  await history();
}
const run = ref<Row | null>(null),
  sequence = ref(0),
  pending = ref<{ key: string; body: Record<string, unknown> } | null>(null);
let controller: AbortController | undefined;
const conversationAttempt = writeAttempt();
const historyState = useConversationHistory(
  () => conversation.value,
  (id, page) =>
    request<Page<Row>>(`/student/conversations/${id}/messages`, {
      query: { page, size: 20, sort: 'createdAt:desc' },
    }),
  errorText,
);
const {
  messages,
  total: historyTotal,
  loading: historyLoading,
  error: historyError,
  load: history,
} = historyState;
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
type Catalog = 'conversations' | 'projects' | 'models';
const catalogs = {
  conversations: {
    rows: conversations,
    page: ref(0),
    total: ref(0),
    loading: ref(false),
    error: ref(''),
  },
  projects: { rows: projects, page: ref(0), total: ref(0), loading: ref(false), error: ref('') },
  models: { rows: models, page: ref(0), total: ref(0), loading: ref(false), error: ref('') },
};
let disposed = false;
async function loadCatalog(name: Catalog) {
  const catalog = catalogs[name];
  if (catalog.loading.value) return;
  catalog.loading.value = true;
  catalog.error.value = '';
  try {
    const next = catalog.page.value + 1;
    const result = await request<Page<Row>>(`/student/${name}`, {
      query: { page: next, size: 20 },
    });
    if (disposed) return;
    const seen = new Set(catalog.rows.value.map((row) => row.id));
    catalog.rows.value.push(...result.items.filter((row) => !seen.has(row.id)));
    catalog.page.value = next;
    catalog.total.value = result.total;
    if (name === 'models' && !model.value && !pending.value)
      model.value = String(models.value[0]?.id || '');
  } catch (e) {
    if (!disposed) catalog.error.value = errorText(e);
  } finally {
    if (!disposed) catalog.loading.value = false;
  }
}
async function initialize() {
  await Promise.all([loadCatalog('conversations'), loadCatalog('projects'), loadCatalog('models')]);
  if (disposed) return;
  model.value = String(models.value[0]?.id || '');
  await resumeSaved();
  if (disposed || busy.value || sessionStorage.getItem(storageKey())) return;
  const conversationId = route.query.conversationId;
  const projectId = route.query.projectId;
  try {
    if (typeof conversationId === 'string' && /^[0-9a-f-]{36}$/i.test(conversationId)) {
      const selected = await request<Row>(`/student/conversations/${conversationId}`);
      if (disposed) return;
      if (!conversations.value.some((row) => row.id === selected.id))
        conversations.value.unshift(selected);
      if (selected.projectId && !projects.value.some((row) => row.id === selected.projectId)) {
        const context = await request<Row>(`/student/projects/${selected.projectId}`);
        if (disposed) return;
        projects.value.unshift(context);
      }
      await chooseConversation(String(selected.id));
    } else if (typeof projectId === 'string' && /^[0-9a-f-]{36}$/i.test(projectId)) {
      const selected = await request<Row>(`/student/projects/${projectId}`);
      if (disposed) return;
      if (!projects.value.some((row) => row.id === selected.id)) projects.value.unshift(selected);
      project.value = String(selected.id);
    }
  } catch (e) {
    if (!disposed) error.value = errorText(e);
  }
}
async function retryHistory() {
  if ((await historyState.retry()) && !busy.value) answer.value = '';
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
      if (await history()) answer.value = '';
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
onBeforeUnmount(() => {
  disposed = true;
  historyState.dispose();
  controller?.abort();
});
</script>
<template>
  <section class="student-chat-layout">
    <button
      class="button conversation-toggle"
      :aria-expanded="conversationListOpen"
      aria-controls="conversation-list-panel"
      @click="conversationListOpen = !conversationListOpen"
    >
      <Icon name="menu" />{{ conversationListOpen ? '收起对话列表' : '选择或新建对话' }}
    </button>
    <aside
      id="conversation-list-panel"
      class="student-chat-sidebar"
      :class="{ 'is-open': conversationListOpen }"
      aria-label="对话列表"
    >
      <button class="button" :disabled="busy || !!pending" @click="chooseConversation('')">
        <Icon name="plus" />新建对话</button
      ><input
        v-model="conversationSearch"
        type="search"
        placeholder="搜索已加载对话"
        aria-label="搜索已加载对话"
      />
      <div class="student-conversation-list">
        <button
          v-for="item in filteredConversations"
          :key="String(item.id)"
          :disabled="busy || !!pending"
          :class="{ selected: String(item.id) === conversation }"
          @click="chooseConversation(String(item.id))"
        >
          <strong>{{ item.title }}</strong
          ><small>{{ display(item.updatedAt || item.createdAt) }}</small>
        </button>
        <p v-if="!filteredConversations.length" class="muted">
          {{
            catalogs.conversations.loading.value
              ? '正在读取对话…'
              : catalogs.conversations.error.value
                ? '对话读取失败，请重试'
                : '暂无匹配对话'
          }}
        </p>
      </div>
      <RouterLink to="/student/profile" class="text-button">查看账户与可用额度</RouterLink>
    </aside>
    <div class="student-chat-main">
      <h1>智能答疑</h1>
      <p class="muted">围绕项目提问，回答与用量均会保存。关闭页面不会自动取消正在执行的答疑。</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="source" class="notice">
        本次引用：{{ sourceTitle
        }}<button class="button" :disabled="busy || !!pending" @click="source = ''">
          移除引用
        </button>
      </p>
      <div class="chat-controls">
        <select
          v-if="!conversation"
          v-model="project"
          :disabled="busy || !!pending"
          aria-label="选择项目"
        >
          <option value="">请选择项目</option>
          <option v-for="p in projects" :key="String(p.id)" :value="p.id">
            {{ p.title }}
          </option></select
        ><select v-model="model" :disabled="busy || !!pending" aria-label="选择模型">
          <option value="">请选择可用模型</option>
          <option v-for="m in models" :key="String(m.id)" :value="m.id">
            {{ m.name }}
          </option>
        </select>
      </div>
      <div
        v-if="
          Object.values(catalogs).some((c) => c.error.value || c.rows.value.length < c.total.value)
        "
        class="chat-controls"
      >
        <template v-for="(catalog, name) in catalogs" :key="name">
          <button
            v-if="catalog.error.value || catalog.rows.value.length < catalog.total.value"
            class="button"
            :disabled="busy || catalog.loading.value"
            @click="loadCatalog(name)"
          >
            {{ catalog.error.value ? '重试读取' : '加载更多'
            }}{{ name === 'conversations' ? '会话' : name === 'projects' ? '项目' : '模型' }}
          </button>
          <span v-if="catalog.error.value" class="error" role="alert">{{
            catalog.error.value
          }}</span>
        </template>
      </div>
      <p v-if="!models.length && catalogs.models.page.value > 0" class="notice">
        当前没有可用模型，请联系平台管理员配置。
      </p>
      <div class="messages" :aria-busy="historyLoading">
        <p v-if="historyError" class="error" role="alert">
          {{ historyError }}
          <button class="button" :disabled="historyLoading" @click="retryHistory">
            重试读取消息
          </button>
        </p>
        <p v-if="historyLoading" class="muted" role="status">正在读取消息…</p>
        <button
          v-if="messages.length < historyTotal"
          class="button"
          :disabled="historyLoading || busy"
          @click="history(true)"
        >
          加载更早消息
        </button>
        <article
          v-for="message in messages"
          :key="String(message.id)"
          :class="['message', message.role === 'USER' ? 'mine' : '']"
        >
          <strong>{{ message.role === 'USER' ? '我的提问' : '智能答疑' }}</strong>
          <p v-if="message.role === 'USER'">{{ message.text }}</p>
          <MarkdownContent v-else :text="String(message.text || '')" />
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
          <MarkdownContent :text="answer" />
        </article>
        <p v-if="!messages.length && !answer && !historyLoading && !historyError" class="empty">
          {{ conversation ? '这段对话还没有消息。' : '选择项目后，输入你的第一个问题。' }}
        </p>
      </div>
      <div v-if="disconnected" class="notice">
        连接已中断，重新连接只获取已保存的回答，不会重新发起模型调用。<button
          class="button"
          @click="subscribe"
        >
          重新连接
        </button>
      </div>
      <p v-if="pending && !busy" class="notice" role="status">
        上次提问的提交结果尚未确认。请重试同一次提问，模型和会话暂时锁定，避免重复创建与计费。
      </p>
      <form class="composer" @submit.prevent="send">
        <textarea
          v-model="text"
          rows="2"
          maxlength="16000"
          placeholder="描述你的问题、报错信息或需要解释的代码"
          aria-label="提问正文"
          :disabled="busy || !!pending"
        />
        <div>
          <span class="muted">{{ text.length }} / 16000</span
          ><button v-if="busy && run" type="button" class="button" @click="cancel">停止答疑</button
          ><button
            class="button primary"
            :disabled="busy || (!pending && (!model || !text.trim()))"
          >
            {{ pending ? '重试同一次提问' : '发送问题' }}
          </button>
        </div>
      </form>
    </div>
    <aside class="student-chat-context" aria-label="项目上下文">
      <h2>项目上下文</h2>
      <article v-if="contextProject">
        <small>当前项目</small>
        <h3>{{ contextProject.title }}</h3>
        <p>{{ display(contextProject.stage) }}</p>
        <progress
          :value="Number(contextProject.progress) || 0"
          max="100"
          aria-label="项目完成度"
        ></progress
        ><RouterLink to="/student/projects" class="text-button"
          >查看项目资料 <Icon name="right"
        /></RouterLink>
      </article>
      <p v-else class="muted">选择项目或已有会话后显示关联项目。</p>
      <article>
        <h3>回答引用</h3>
        <p v-if="source">{{ sourceTitle }}</p>
        <p v-else>已保存回答中的引用可在消息下方展开查看。</p>
        <RouterLink to="/student/search" class="text-button">检索知识资料</RouterLink>
      </article>
    </aside>
  </section>
</template>
<style scoped>
.conversation-toggle {
  display: none;
}
@media (max-width: 800px) {
  .conversation-toggle {
    display: flex;
    margin: 12px 16px 0;
    justify-self: start;
  }
}
.chat-controls {
  display: flex;
  gap: 12px;
  margin: 12px 0;
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
  margin-top: 12px;
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
