<script setup lang="ts">
import ChatKnowledgePicker from '../components/ChatKnowledgePicker.vue';
import QuotaChart from '../components/QuotaChart.vue';
import AppSelect from '../components/AppSelect.vue';
import { useRoute } from 'vue-router';
import Icon from '../components/Icon.vue';
import { display } from '../config/labels';
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
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
const materialsOpen = ref(false);
const wideContext = ref(false);
const contextMedia = window.matchMedia('(min-width: 1180px)');
function syncContextLayout() {
  wideContext.value = contextMedia.matches;
}
onMounted(() => {
  syncContextLayout();
  contextMedia.addEventListener('change', syncContextLayout);
});
onBeforeUnmount(() => contextMedia.removeEventListener('change', syncContextLayout));
const selectedSources = ref<{ versionId: string; title: string }[]>(
  source.value ? [{ versionId: source.value, title: sourceTitle }] : [],
);
const autoKnowledge = ref(true);
const retrievalNotice = ref('');
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
const quota = ref<Row | null>(null),
  quotaError = ref('');
let quotaDisposed = false;
async function refreshQuota() {
  try {
    const value = await request<Row>('/student/quota');
    if (!quotaDisposed) {
      quota.value = value;
      quotaError.value = '';
    }
  } catch (e) {
    if (!quotaDisposed) quotaError.value = errorText(e);
  }
}
const conversationSearch = ref('');
let catalogGeneration = 0;
async function searchConversations() {
  catalogGeneration++;
  catalogs.conversations.page.value = 0;
  catalogs.conversations.rows.value = [];
  catalogs.conversations.total.value = 0;
  catalogs.conversations.loading.value = false;
  await loadCatalog('conversations');
}
const conversationListOpen = ref(false);
const activeConversation = ref<Row | null>(null);
const filteredConversations = computed(() => conversations.value);
const contextProject = computed(() =>
  projects.value.find(
    (p) =>
      String(p.id) ===
      String(
        (activeConversation.value?.id === conversation.value
          ? activeConversation.value.projectId
          : conversations.value.find((c) => String(c.id) === conversation.value)?.projectId) ||
          project.value,
      ),
  ),
);
async function chooseConversation(id: string) {
  if (busy.value || pending.value) return;
  conversationListOpen.value = false;
  conversation.value = id;
  activeConversation.value = conversations.value.find((c) => String(c.id) === id) || null;
  answer.value = '';
  disconnected.value = false;
  await history();
}
const run = ref<Row | null>(null),
  sequence = ref(0),
  pending = ref<{ key: string; body: Record<string, unknown> } | null>(null);
let controller: AbortController | undefined;
let conversationAttempt = writeAttempt();
const draftNotice = ref('');
const checkingConversation = ref(false);
async function newConversation() {
  if (checkingConversation.value) return;
  checkingConversation.value = true;
  try {
    if (busy.value || pending.value) {
      if (!run.value?.id) {
        error.value = '上次提交结果尚未确认，请先使用原请求重试，避免重复计费。';
        return;
      }
      const latest = await request<Row>(`/student/runs/${run.value.id}`);
      if (!['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(String(latest.state))) {
        error.value = '当前回答仍在处理，请等待完成，或先停止本次答疑。';
        return;
      }
      controller?.abort();
      pending.value = null;
      busy.value = false;
      sessionStorage.removeItem(storageKey());
    }
    await chooseConversation('');
    text.value = '';
    error.value = '';
    project.value = '';
    run.value = null;
    sequence.value = 0;
    conversationAttempt = writeAttempt();
    draftNotice.value = '已开启新对话，请选择项目并输入第一个问题。';
  } catch (e) {
    error.value = errorText(e);
  } finally {
    checkingConversation.value = false;
  }
}
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
  const current = catalogGeneration;
  if (catalog.loading.value) return;
  catalog.loading.value = true;
  catalog.error.value = '';
  try {
    const next = catalog.page.value + 1;
    const result = await request<Page<Row>>(`/student/${name}`, {
      query: {
        page: next,
        size: 20,
        ...(name === 'conversations' ? { q: conversationSearch.value } : {}),
      },
    });
    if (disposed || (name === 'conversations' && current !== catalogGeneration)) return;
    const seen = new Set(catalog.rows.value.map((row) => row.id));
    catalog.rows.value.push(...result.items.filter((row) => !seen.has(row.id)));
    catalog.page.value = next;
    catalog.total.value = result.total;
    if (name === 'models' && !model.value && !pending.value)
      model.value = String(models.value[0]?.id || '');
  } catch (e) {
    if (!disposed && (name !== 'conversations' || current === catalogGeneration))
      catalog.error.value = errorText(e);
  } finally {
    if (!disposed && (name !== 'conversations' || current === catalogGeneration))
      catalog.loading.value = false;
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
        activeConversation.value = c;
        conversations.value.unshift(c);
      }
      let sourceIds = selectedSources.value.map((x) => x.versionId);
      retrievalNotice.value = '';
      if (autoKnowledge.value) {
        const found = await request<Page<Row>>('/student/knowledge-search', {
          query: { q: text.value.trim().slice(0, 100), mode: 'QUESTION', page: 1, size: 3 },
        });
        sourceIds = [
          ...new Set([...sourceIds, ...found.items.map((x) => String(x.versionId))]),
        ].slice(0, 8);
        retrievalNotice.value = found.items.length
          ? `已检索到${found.items.length}份可访问知识，并随本次问题提交。`
          : '未检索到相关知识，本次回答仅使用对话和手动选择的资料。';
      }
      run.value = null;
      pending.value = {
        key: crypto.randomUUID(),
        body: {
          conversationId: conversation.value,
          clientMessageId: crypto.randomUUID(),
          text: text.value,
          modelId: model.value,
          sourceVersionIds: sourceIds,
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
onMounted(() => {
  initialize();
  void refreshQuota();
});
watch(busy, (value, previous) => {
  if (previous && !value) void refreshQuota();
});
onBeforeUnmount(() => {
  quotaDisposed = true;
  disposed = true;
  historyState.dispose();
  controller?.abort();
});
</script>
<template>
  <section class="qa-chat-layout">
    <aside
      class="qa-chat-sidebar"
      :class="{ 'is-open': conversationListOpen }"
      aria-label="对话列表"
    >
      <button class="button" :disabled="checkingConversation" @click="newConversation">
        <Icon name="plus" />新建对话
      </button>
      <form @submit.prevent="searchConversations">
        <input
          v-model="conversationSearch"
          type="search"
          placeholder="搜索对话"
          aria-label="搜索全部对话标题"
        /><button class="text-button" :disabled="busy || !!pending">搜索</button>
      </form>
      <div class="qa-session-list">
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
              ? '正在读取…'
              : catalogs.conversations.error.value || '暂无匹配对话'
          }}
        </p>
        <button
          v-if="
            conversations.length < catalogs.conversations.total.value ||
            catalogs.conversations.error.value
          "
          class="text-button"
          @click="loadCatalog('conversations')"
        >
          {{ catalogs.conversations.error.value ? '重试读取' : '加载更多对话' }}
        </button>
      </div>
      <section class="qa-quota">
        <h3>本月可用额度</h3>
        <QuotaChart v-if="quota" :quota="quota" compact />
        <p v-if="quotaError" class="error">
          {{ quotaError }}<button class="text-button" @click="refreshQuota">重试</button>
        </p>
        <RouterLink to="/student/profile">用量明细</RouterLink>
      </section>
    </aside>
    <main class="qa-chat-main">
      <header class="qa-chat-bar">
        <div>
          <button
            class="button qa-mobile"
            @click="conversationListOpen = !conversationListOpen"
            :aria-expanded="conversationListOpen"
          >
            对话
          </button>
          <h1>{{ activeConversation?.title || '新对话' }}</h1>
          <small>{{ contextProject?.title || '选择项目，开始新的问题' }}</small>
        </div>
        <button class="button" @click="materialsOpen = true">
          项目与知识资料 <span v-if="selectedSources.length">{{ selectedSources.length }}</span>
        </button>
      </header>
      <div class="qa-messages" :aria-busy="historyLoading">
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <p v-if="draftNotice && !conversation" class="notice" role="status">{{ draftNotice }}</p>
        <p v-if="historyError" class="error" role="alert">
          {{ historyError
          }}<button class="button" :disabled="historyLoading" @click="retryHistory">
            重试读取消息
          </button>
        </p>
        <p v-if="historyLoading" role="status">正在读取消息…</p>
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
          class="qa-message"
          :class="{ mine: message.role === 'USER' }"
        >
          <small v-if="message.role !== 'USER'" class="qa-answer-label">知项答疑</small>
          <p v-if="message.role === 'USER'">{{ message.text }}</p>
          <MarkdownContent v-else :text="String(message.text || '')" copy-code />
          <details v-if="citations(message).length" class="qa-citations">
            <summary>本次参考资料（{{ citations(message).length }}）</summary>
            <blockquote v-for="(citation, index) in citations(message)" :key="citation.chunkId">
              <small
                >[{{ index + 1 }}] 知识版本 {{ citation.versionId.slice(0, 8)
                }}<template v-if="citation.page > 0"> · 分片 {{ citation.page }}</template></small
              >
              <p>{{ citation.quote }}</p>
            </blockquote>
            <p class="muted">展示本次提交给模型的原文片段，请结合回答核实。</p>
          </details>
        </article>
        <article v-if="answer" class="qa-message">
          <small class="qa-answer-label">知项答疑 · 正在回答</small
          ><MarkdownContent :text="answer" copy-code />
        </article>
        <div
          v-if="!messages.length && !answer && !historyLoading && !historyError"
          class="qa-empty"
        >
          <small>从一个具体问题开始</small>
          <h2>今天想解决什么？</h2>
          <p>选择项目，带上知识资料，让回答更贴近你的任务。</p>
          <AppSelect
            v-if="!conversation"
            v-model="project"
            :disabled="busy || !!pending"
            aria-label="选择项目"
            ><option value="">请选择项目</option>
            <option v-for="p in projects" :key="String(p.id)" :value="p.id">
              {{ p.title }}
            </option></AppSelect
          >
          <div class="question-templates">
            <button
              v-for="prompt in [
                '请解释这段代码的作用：',
                '请帮我分析这个报错，并说明排查步骤：',
                '请帮我梳理当前项目的实现思路：',
              ]"
              :key="prompt"
              type="button"
              class="button"
              :disabled="busy || !!pending"
              @click="text = prompt"
            >
              {{ prompt.replace('：', '') }}
            </button>
          </div>
        </div>
      </div>
      <div class="qa-composer-wrap">
        <p v-if="retrievalNotice" class="muted qa-small" role="status">{{ retrievalNotice }}</p>
        <div v-if="disconnected" class="notice">
          连接已中断，重连只读取已保存回答。<button class="text-button" @click="subscribe">
            重新连接
          </button>
        </div>
        <p v-if="pending && !busy" class="notice">提交结果尚未确认，请重试同一次提问。</p>
        <form class="qa-composer" @submit.prevent="send">
          <textarea
            v-model="text"
            rows="2"
            maxlength="16000"
            placeholder="继续提问，或添加知识资料帮助回答…"
            aria-label="提问正文"
            :disabled="busy || !!pending"
          />
          <div class="qa-composer-tools">
            <div>
              <AppSelect v-model="model" :disabled="busy || !!pending" aria-label="选择模型"
                ><option value="">请选择模型</option>
                <option v-for="m in models" :key="String(m.id)" :value="m.id">
                  {{ m.name }}
                </option></AppSelect
              ><button type="button" class="text-button" @click="materialsOpen = true">
                引用知识
              </button>
            </div>
            <div>
              <small class="muted">{{ text.length }} / 16000</small
              ><button v-if="busy && run" type="button" class="button" @click="cancel">停止</button
              ><button
                class="button primary"
                :disabled="busy || (!pending && (!model || !text.trim()))"
              >
                {{ busy ? '处理中…' : pending ? '重试原请求' : '发送' }}
              </button>
            </div>
          </div>
        </form>
        <p class="qa-composer-hint">
          回答可能有误，请结合资料核实。关闭页面不会取消正在生成的回答。
        </p>
      </div>
    </main>
    <Teleport to="body" :disabled="wideContext"
      ><div
        v-if="materialsOpen || wideContext"
        class="qa-drawer-mask"
        :class="{ 'qa-context-inline': wideContext }"
        @click.self="materialsOpen = false"
      >
        <aside
          :key="wideContext ? 'inline-context' : 'mobile-context'"
          v-dialog="wideContext ? undefined : () => (materialsOpen = false)"
          :role="wideContext ? 'complementary' : 'dialog'"
          :aria-modal="wideContext ? undefined : true"
          aria-label="项目与知识资料"
          class="qa-drawer"
        >
          <header>
            <h2>项目与知识资料</h2>
            <button v-if="!wideContext" class="text-button" @click="materialsOpen = false">
              关闭
            </button>
          </header>
          <h3>当前项目</h3>
          <p v-if="conversation">{{ contextProject?.title || '当前会话关联项目' }}</p>
          <AppSelect v-else v-model="project" :disabled="busy || !!pending" aria-label="选择项目"
            ><option value="">请选择项目</option>
            <option v-for="p in projects" :key="String(p.id)" :value="p.id">
              {{ p.title }}
            </option></AppSelect
          ><template v-for="name in ['projects', 'models'] as const" :key="name"
            ><p v-if="catalogs[name].error.value" class="error">{{ catalogs[name].error.value }}</p>
            <button
              v-if="
                catalogs[name].error.value ||
                catalogs[name].rows.value.length < catalogs[name].total.value
              "
              class="text-button"
              :disabled="catalogs[name].loading.value"
              @click="loadCatalog(name)"
            >
              {{ name === 'projects' ? '加载更多项目' : '加载更多模型' }}
            </button></template
          ><label class="qa-auto"
            ><input
              v-model="autoKnowledge"
              type="checkbox"
              :disabled="busy || !!pending"
            />自动检索相关知识（关键词）</label
          >
          <p class="muted qa-small">
            未命中会明确说明；语义检索需另行配置，不产生额外 embedding 调用。
          </p>
          <div v-for="item in selectedSources" :key="item.versionId" class="qa-selected">
            <span>{{ item.title }}</span
            ><button
              class="text-button"
              :disabled="busy || !!pending"
              @click="
                selectedSources = selectedSources.filter((x) => x.versionId !== item.versionId)
              "
            >
              移除
            </button>
          </div>
          <ChatKnowledgePicker
            :selected="selectedSources"
            :disabled="busy || !!pending"
            @change="selectedSources = $event"
          />
        </aside></div
    ></Teleport>
  </section>
</template>
<style scoped>
.qa-chat-layout {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  height: calc(100dvh - 72px);
  min-height: 500px;
  background: white;
}
.qa-chat-sidebar {
  padding: 24px 16px;
  background: #f3f5f9;
  border-right: 1px solid #e5e9ef;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}
.qa-chat-sidebar form {
  display: flex;
  gap: 6px;
}
.qa-chat-sidebar form > button {
  flex-shrink: 0;
  white-space: nowrap;
}
.qa-chat-sidebar input {
  width: 100%;
  min-width: 0;
}
.qa-session-list {
  flex: 1;
  overflow: auto;
}
.qa-session-list > button {
  display: block;
  width: 100%;
  text-align: left;
  margin: 7px 0;
  border: 0;
  background: transparent;
  padding: 12px;
  border-radius: 8px;
  color: #26334a;
}
.qa-session-list > button.selected {
  background: white;
  color: #315cde;
}
.qa-session-list strong {
  font-size: 13px;
  font-weight: 500;
  display: block;
  overflow-wrap: anywhere;
}
.qa-session-list small {
  display: block;
  font-size: 11px;
  color: #788398;
  margin-top: 4px;
}
.qa-quota {
  border-top: 1px solid #e5e9ef;
  padding-top: 14px;
  font-size: 12px;
}
.qa-quota h3 {
  font-size: 12px;
}
.qa-chat-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.qa-chat-bar {
  padding: 16px 30px;
  border-bottom: 1px solid #e5e9ef;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}
.qa-chat-bar h1 {
  font-weight: 600;
  font-size: 16px;
  line-height: 1.5;
  margin: 0;
  overflow-wrap: anywhere;
}
.qa-chat-bar small {
  font-size: 12px;
  color: #788398;
}
.qa-chat-bar > button {
  flex-shrink: 0;
}
.qa-messages {
  flex: 1;
  min-height: 100px;
  overflow: auto;
  padding: 30px max(28px, calc((100% - 800px) / 2));
}
.qa-message {
  margin-bottom: 28px;
  line-height: 1.9;
  font-size: 15px;
  overflow-wrap: anywhere;
}
.qa-message.mine {
  background: #f0f3fa;
  border-radius: 14px 14px 3px 14px;
  max-width: 85%;
  width: fit-content;
  margin-left: auto;
  padding: 12px 17px;
}
.qa-message.mine p {
  margin: 0;
  white-space: pre-wrap;
}
.qa-answer-label {
  display: block;
  color: #355ee8;
  margin-bottom: 12px;
  font-size: 12px;
}
.qa-message :deep(.reading-prose) {
  font-size: 15px;
}
.qa-message :deep(pre) {
  background: #fafbfd;
  color: #354460;
  border: 1px solid #e5e9ef;
  border-radius: 8px;
  font-size: 13px;
}
.qa-citations {
  font-size: 12px;
  color: #45649b;
  margin-top: 16px;
}
.qa-citations blockquote {
  margin: 10px 0;
  padding: 12px;
  background: #f7f9fc;
  border-left: 2px solid #cad6ec;
}
.qa-citations p {
  white-space: pre-wrap;
}
.qa-composer-wrap {
  padding: 12px max(28px, calc((100% - 850px) / 2)) 15px;
  background: white;
  flex-shrink: 0;
}
.qa-composer {
  border: 1px solid #d7deeb;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 18px #17223805;
}
.qa-composer textarea {
  border: 0;
  resize: vertical;
  width: 100%;
  min-height: 65px;
  max-height: 150px;
  padding: 4px;
  box-shadow: none;
}
.qa-composer-tools {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}
.qa-composer-tools > div {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}
.qa-composer-tools :deep(.app-select) {
  max-width: 200px;
  font-size: 12px;
}
.qa-composer-tools small {
  font-size: 11px;
}
.qa-composer-hint {
  text-align: center;
  font-size: 11px;
  color: #788398;
  margin: 7px 0 0;
}
.qa-empty {
  text-align: center;
  padding: 35px 0;
}
.qa-empty h2 {
  font-size: 26px;
  font-family: inherit;
}
.qa-empty p {
  font-size: 13px;
  color: #788398;
}
.qa-empty :deep(.app-select) {
  max-width: 360px;
  margin: 18px auto;
}
.question-templates {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 20px;
}
.question-templates button {
  font-size: 12px;
}
.qa-mobile {
  display: none;
}
.qa-small {
  font-size: 12px;
}
.qa-drawer-mask {
  position: fixed;
  inset: 0;
  background: #17223830;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}
.qa-drawer {
  background: white;
  width: min(390px, 100%);
  height: 100dvh;
  overflow: auto;
  padding: 26px;
  box-shadow: -12px 0 32px #17223809;
}
.qa-drawer header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.qa-drawer h2 {
  font-size: 18px;
}
.qa-drawer h3 {
  font-size: 15px;
  margin-top: 24px;
}
.qa-drawer :deep(.app-select) {
  width: 100%;
}
.qa-auto {
  display: flex;
  gap: 8px;
  margin: 24px 0 8px;
  align-items: center;
}
.qa-selected {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  gap: 10px;
  border-bottom: 1px solid #e5e9ef;
}
@media (max-width: 800px) {
  .qa-chat-layout {
    grid-template-columns: 1fr;
    height: calc(100dvh - 72px);
    min-height: 450px;
  }
  .qa-chat-sidebar {
    display: none;
  }
  .qa-chat-sidebar.is-open {
    display: flex;
    position: fixed;
    inset: 72px 25% 0 0;
    z-index: 100;
    background: #f3f5f9;
    box-shadow: 15px 0 30px #17223830;
  }
  .qa-mobile {
    display: inline-flex;
    margin-right: 8px;
  }
  .qa-chat-bar {
    padding: 12px 16px;
  }
  .qa-chat-bar h1 {
    font-size: 14px;
    display: inline;
  }
  .qa-chat-bar small {
    display: none;
  }
  .qa-chat-bar > button {
    font-size: 12px;
    padding: 6px 8px;
  }
  .qa-messages {
    padding: 22px 20px;
  }
  .qa-composer-wrap {
    padding: 8px 12px 12px;
  }
  .qa-composer-tools {
    flex-wrap: wrap;
  }
  .qa-composer-tools :deep(.app-select) {
    max-width: 170px;
  }
  .qa-composer-tools small {
    display: none;
  }
  .qa-composer-tools button {
    font-size: 12px;
  }
  .qa-composer-hint {
    font-size: 10px;
  }
  .qa-empty h2 {
    font-size: 22px;
  }
}
.qa-context-inline {
  position: static;
  z-index: auto;
  min-width: 0;
  min-height: 0;
  background: white;
  border-left: 1px solid #e6e8f2;
}
.qa-context-inline .qa-drawer {
  width: 100%;
  height: 100%;
  padding: 22px 18px;
  box-shadow: none;
}
.qa-context-inline h2 {
  font-size: 16px;
}
</style>
