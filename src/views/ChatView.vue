<script setup lang="ts">
import UserAvatar from '../components/UserAvatar.vue';
import ChatKnowledgePicker from '../components/ChatKnowledgePicker.vue';
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
const contextMedia = window.matchMedia('(min-width: 1101px)');
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
    draftNotice.value = '已开启新对话，可以直接提问，也可以关联项目。';
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
      if (!text.value.trim()) throw new Error('请输入问题');
      if (!conversation.value) {
        const c = await request<Row>('/student/conversations', {
          method: 'POST',
          body: { projectId: project.value || null, title: text.value.slice(0, 40) },
          key: conversationAttempt({
            projectId: project.value || null,
            title: text.value.slice(0, 40),
          }),
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
    if (
      e instanceof ApiError &&
      ([400, 403, 404, 409, 412, 422].includes(e.status) ||
        ['MODEL_UNAVAILABLE', 'MODEL_PROVIDER_DISABLED'].includes(String(e.problem.code)))
    )
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
const deleteTarget = ref<Row | null>(null);
const deleting = ref(false);
async function deleteConversation() {
  if (!deleteTarget.value || deleting.value || busy.value || pending.value) return;
  deleting.value = true;
  try {
    const row = deleteTarget.value;
    await request(`/student/conversations/${row.id}`, {
      method: 'DELETE',
      version: Number(row.version),
      key: crypto.randomUUID(),
    });
    conversations.value = conversations.value.filter((item) => item.id !== row.id);
    catalogs.conversations.total.value = Math.max(0, catalogs.conversations.total.value - 1);
    if (String(row.id) === conversation.value) await newConversation();
    deleteTarget.value = null;
  } catch (e) {
    error.value = errorText(e);
  } finally {
    deleting.value = false;
  }
}
function inputKey(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    if (!busy.value && !pending.value && text.value.trim()) void send();
  }
}
function closePanels(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    materialsOpen.value = false;
    conversationListOpen.value = false;
  }
}
onMounted(() => window.addEventListener('keydown', closePanels));
onBeforeUnmount(() => window.removeEventListener('keydown', closePanels));
</script>
<template>
  <section class="qa-chat-layout" :class="{ 'with-materials': materialsOpen && wideContext }">
    <button
      v-if="conversationListOpen"
      class="qa-history-mask"
      aria-label="关闭对话列表"
      @click="conversationListOpen = false"
    />
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
        <div
          v-for="item in filteredConversations"
          :key="String(item.id)"
          class="qa-session"
          :class="{ selected: String(item.id) === conversation }"
        >
          <button
            class="qa-session-open"
            :disabled="busy || !!pending"
            @click="chooseConversation(String(item.id))"
          >
            <strong>{{ item.title }}</strong
            ><small>{{ display(item.updatedAt || item.createdAt) }}</small>
          </button>
          <button
            class="qa-session-delete"
            :aria-label="`删除对话：${item.title}`"
            :disabled="busy || !!pending"
            @click="deleteTarget = item"
          >
            <Icon name="trash" />
          </button>
        </div>
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
        <div v-if="quota" class="qa-quota-summary">
          <strong>{{ Number(quota.availableTokens || 0).toLocaleString('zh-CN') }}</strong
          ><span> 可用词元</span>
          <p>预占 {{ Number(quota.reservedTokens || 0).toLocaleString('zh-CN') }} 词元</p>
        </div>
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
          <h1>{{ activeConversation?.title || '新的对话' }}</h1>
          <label class="qa-project"
            ><span>关联项目</span>
            <AppSelect
              v-if="!conversation"
              v-model="project"
              :disabled="busy || !!pending"
              aria-label="关联项目"
            >
              <option value="">不关联项目</option>
              <option v-for="p in projects" :key="String(p.id)" :value="p.id">
                {{ p.title }}
              </option> </AppSelect
            ><span v-else>{{
              contextProject?.title ||
              (activeConversation?.projectId ? '当前关联项目' : '不关联项目')
            }}</span>
          </label>
          <button
            v-if="projects.length < catalogs.projects.total.value || catalogs.projects.error.value"
            class="text-button"
            @click="loadCatalog('projects')"
          >
            {{ catalogs.projects.error.value ? '重试项目' : '更多项目' }}
          </button>
        </div>
        <button
          class="button"
          :aria-expanded="materialsOpen"
          @click="materialsOpen = !materialsOpen"
        >
          参考资料 <span v-if="selectedSources.length">{{ selectedSources.length }}</span>
        </button>
      </header>
      <div class="qa-messages" :aria-busy="historyLoading">
        <div class="qa-thread-inner">
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
            <UserAvatar
              v-if="message.role === 'USER'"
              :index="auth.user?.avatarIndex"
              :asset-id="auth.user?.avatarAssetId"
              :size="34"
            />
            <span v-else class="qa-ai-avatar"><Icon name="sparkles" /></span>
            <div class="qa-message-content">
              <small v-if="message.role !== 'USER'" class="qa-answer-label">知项答疑</small>
              <p v-if="message.role === 'USER'">{{ message.text }}</p>
              <MarkdownContent v-else :text="String(message.text || '')" copy-code />
              <details v-if="citations(message).length" class="qa-citations">
                <summary>本次参考资料（{{ citations(message).length }}）</summary>
                <blockquote v-for="(citation, index) in citations(message)" :key="citation.chunkId">
                  <small
                    >[{{ index + 1 }}] 知识版本 {{ citation.versionId.slice(0, 8)
                    }}<template v-if="citation.page > 0">
                      · 分片 {{ citation.page }}</template
                    ></small
                  >
                  <p>{{ citation.quote }}</p>
                </blockquote>
                <p class="muted">展示本次提交给模型的原文片段，请结合回答核实。</p>
              </details>
            </div>
          </article>
          <article v-if="answer" class="qa-message">
            <span class="qa-ai-avatar"><Icon name="sparkles" /></span>
            <div class="qa-message-content">
              <small class="qa-answer-label">知项答疑 · 正在回答</small
              ><MarkdownContent :text="answer" copy-code />
            </div>
          </article>
          <div
            v-if="!messages.length && !answer && !historyLoading && !historyError"
            class="qa-empty"
          >
            <span class="qa-welcome-icon"><Icon name="sparkles" /></span>
            <h2>今天想解决什么问题？</h2>
            <p>直接提问，或者关联项目，让问题更有上下文。</p>
            <div class="question-templates">
              <button
                v-for="prompt in [
                  '请解释这段代码的作用：',
                  '请帮我分析这个报错，并说明排查步骤：',
                  '请帮我梳理当前项目的实现思路：',
                  '请帮我检查接口和页面的联调步骤：',
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
            @keydown="inputKey"
            rows="2"
            maxlength="16000"
            placeholder="继续提问，或添加知识资料帮助回答…"
            aria-label="提问正文"
            :disabled="busy || !!pending"
          />
          <div class="qa-composer-tools">
            <div>
              <button type="button" class="text-button" @click="materialsOpen = true">
                引用知识
              </button>
            </div>
            <div>
              <small class="muted">Enter 发送 · Shift+Enter 换行</small
              ><button v-if="busy && run" type="button" class="button" @click="cancel">停止</button
              ><button class="button primary" :disabled="busy || (!pending && !text.trim())">
                {{ busy ? '处理中…' : pending ? '重试原请求' : '发送' }}
              </button>
            </div>
          </div>
        </form>
        <p class="qa-composer-hint">AI 回答仅供参考，请结合实际资料核实。</p>
      </div>
    </main>
    <Teleport to="body" :disabled="wideContext"
      ><div
        v-if="materialsOpen"
        class="qa-drawer-mask"
        :class="{ 'qa-context-inline': wideContext }"
        @click.self="materialsOpen = false"
      >
        <aside
          :key="wideContext ? 'inline-context' : 'mobile-context'"
          v-dialog="wideContext ? undefined : () => (materialsOpen = false)"
          :role="wideContext ? 'complementary' : 'dialog'"
          :aria-modal="wideContext ? undefined : true"
          aria-label="参考资料"
          class="qa-drawer"
        >
          <header>
            <h2>参考资料</h2>
            <button class="text-button" @click="materialsOpen = false">关闭</button>
          </header>
          <label class="qa-auto"
            ><input
              v-model="autoKnowledge"
              type="checkbox"
              :disabled="busy || !!pending"
            />自动检索相关知识（关键词）</label
          >
          <p class="muted qa-small">选择与问题相关的资料，帮助回答更准确。</p>
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
  <Teleport to="body"
    ><div
      v-if="deleteTarget"
      class="modal-backdrop"
      @click.self="!deleting && (deleteTarget = null)"
    >
      <section
        class="modal qa-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="删除对话"
        v-dialog="
          () => {
            if (!deleting) deleteTarget = null;
          }
        "
      >
        <h2>删除这段对话？</h2>
        <p>{{ deleteTarget.title }}</p>
        <p class="muted">删除后将从你的对话列表隐藏，历史用量和账务记录仍会保留。</p>
        <div class="actions">
          <button class="button" :disabled="deleting" @click="deleteTarget = null">取消</button
          ><button class="button danger" :disabled="deleting" @click="deleteConversation">
            {{ deleting ? '删除中…' : '删除对话' }}
          </button>
        </div>
      </section>
    </div></Teleport
  >
</template>
<style scoped>
.qa-chat-layout {
  display: grid;
  grid-template-columns: 216px minmax(0, 1fr);
  height: calc(100dvh - 92px);
  min-height: 0;
  background: white;
  overflow: hidden;
  color: #27283e;
}
.qa-chat-layout.with-materials {
  grid-template-columns: 216px minmax(0, 1fr) 288px;
}
.qa-chat-sidebar {
  padding: 18px 12px;
  background: #f7f7fc;
  border-right: 1px solid #e5e4f0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}
.qa-chat-sidebar > .button {
  min-height: 42px;
  background: #7359e9;
  color: white;
  justify-content: center;
}
.qa-chat-sidebar form {
  display: flex;
  gap: 4px;
  min-width: 0;
}
.qa-chat-sidebar form > button {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 6px;
}
.qa-chat-sidebar input {
  width: 100%;
  min-width: 0;
}
.qa-session-list {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
.qa-session {
  display: flex;
  align-items: center;
  border-radius: 10px;
  margin-bottom: 5px;
  min-height: 54px;
  padding: 6px;
}
.qa-session.selected {
  background: #eae4fa;
  color: #5f48b7;
}
.qa-session-open {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 6px;
  border: 0;
  background: transparent;
  color: inherit;
}
.qa-session strong {
  display: block;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.qa-session small {
  font-size: 11px;
  color: #9290a5;
}
.qa-session-delete {
  border: 0;
  background: transparent;
  padding: 7px;
  opacity: 0;
  color: inherit;
}
.qa-session:hover .qa-session-delete,
.qa-session.selected .qa-session-delete,
.qa-session:focus-within .qa-session-delete {
  opacity: 1;
}
.qa-quota {
  padding: 16px 10px 0;
  border-top: 1px solid #e4e3ed;
  font-size: 12px;
}
.qa-quota h3 {
  font-size: 12px;
}
.qa-quota-summary strong {
  font-size: 18px;
  color: #6a5c96;
}
.qa-chat-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.qa-chat-bar {
  min-height: 70px;
  flex-shrink: 0;
  padding: 10px 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f0eef5;
  gap: 10px;
}
.qa-chat-bar > div {
  display: flex;
  gap: 22px;
  align-items: center;
  min-width: 0;
}
.qa-chat-bar h1 {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.5;
  margin: 0;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qa-chat-bar > .button {
  white-space: nowrap;
  font-size: 12px;
}
.qa-project {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #656477;
  min-width: 0;
}
.qa-project :deep(.app-select) {
  width: 230px;
  max-width: 100%;
  font-size: 12px;
}
.qa-project > span:last-child {
  max-width: 230px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qa-messages {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scroll-behavior: smooth;
  padding: 24px 20px 12px;
}
.qa-thread-inner {
  max-width: 1100px;
  margin: auto;
  min-height: 100%;
}
.qa-thread-inner:has(.qa-empty) {
  height: 100%;
}
.qa-message {
  display: flex;
  gap: 12px;
  margin: 0 0 26px;
  align-items: flex-start;
  font-size: 14px;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.qa-message.mine {
  flex-direction: row-reverse;
}
.qa-message-content {
  max-width: min(calc(100% - 46px), 800px);
  min-width: 0;
}
.mine .qa-message-content {
  max-width: min(calc(100% - 46px), 560px);
}
.mine p {
  margin: 0;
  padding: 13px 18px;
  background: #f2edff;
  border-radius: 16px 4px 16px 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.85;
}
.qa-ai-avatar {
  display: grid;
  place-items: center;
  background: #7359e9;
  color: white;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  flex-shrink: 0;
}
.qa-ai-avatar :deep(.zx-icon) {
  color: white;
}
.qa-answer-label {
  display: block;
  font-size: 12px;
  color: #7258d5;
  font-weight: 650;
  margin: 3px 0 10px;
}
.qa-message :deep(.reading-prose) {
  font-size: 14px;
  line-height: 1.9;
}
.qa-message :deep(pre) {
  max-width: 100%;
  overflow: auto;
  font-size: 13px;
}
.qa-citations {
  font-size: 12px;
  color: #7c748e;
  margin-top: 14px;
}
.qa-citations blockquote {
  margin: 10px 0;
  padding: 12px;
  background: #f7f5fc;
  border-left: 2px solid #d5caee;
}
.qa-composer-wrap {
  padding: 12px 20px 10px;
  background: white;
  flex-shrink: 0;
}
.qa-composer {
  max-width: 1100px;
  margin: auto;
  border: 1px solid #dcd5ef;
  border-radius: 15px;
  box-shadow: 0 4px 18px #42346d08;
  padding: 13px 16px;
}
.qa-composer:focus-within {
  border-color: #a592e9;
  box-shadow: 0 0 0 3px #f6f2ff;
}
.qa-composer textarea {
  display: block;
  border: 0;
  outline: 0;
  width: 100%;
  resize: none;
  min-height: 64px;
  max-height: 160px;
  line-height: 1.7;
  box-shadow: none;
  padding: 0;
}
.qa-composer-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.qa-composer-tools > div {
  display: flex;
  gap: 14px;
  align-items: center;
}
.qa-composer-tools small {
  font-size: 11px;
}
.qa-composer-tools .primary {
  height: 34px;
  background: #7359e9;
}
.qa-composer-hint {
  text-align: center;
  color: #aaa6b5;
  font-size: 10px;
  margin: 9px 0 0;
}
.qa-small {
  font-size: 12px;
}
.qa-empty {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  padding: 40px 0;
}
.qa-empty h2 {
  font-size: 28px;
  font-weight: 600;
  margin: 16px 0 8px;
}
.qa-empty p {
  color: #9890a8;
  font-size: 13px;
}
.qa-welcome-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #7359e9;
  color: white;
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
  padding: 9px 14px;
}
.qa-drawer-mask {
  position: fixed;
  inset: 68px 0 0;
  background: #27203533;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}
.qa-drawer {
  width: min(320px, 90vw);
  height: 100%;
  overflow: auto;
  padding: 20px;
  background: #fdfcff;
}
.qa-drawer header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.qa-drawer h2 {
  font-size: 14px;
  margin: 0;
}
.qa-context-inline {
  position: static;
  background: none;
  min-width: 0;
  min-height: 0;
  border-left: 1px solid #ece8f4;
  z-index: auto;
}
.qa-context-inline .qa-drawer {
  width: 288px;
}
.qa-auto {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin: 20px 0 8px;
}
.qa-selected {
  display: flex;
  gap: 8px;
  justify-content: space-between;
  font-size: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #eeeaf5;
}
.qa-mobile,
.qa-history-mask {
  display: none;
}
.qa-delete-dialog {
  max-width: 390px;
  padding: 24px;
}
.qa-delete-dialog .actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
@media (min-width: 1600px) {
  .qa-thread-inner,
  .qa-composer {
    max-width: 1280px;
  }
}
@media (max-width: 1100px) {
  .qa-chat-bar {
    padding: 10px 20px;
  }
  .qa-chat-bar > div {
    gap: 10px;
  }
  .qa-project :deep(.app-select) {
    width: 180px;
  }
}
@media (max-width: 700px) {
  .qa-chat-layout {
    grid-template-columns: minmax(0, 1fr);
    height: calc(100dvh - 80px);
  }
  .qa-chat-sidebar {
    display: none;
  }
  .qa-chat-sidebar.is-open {
    display: flex;
    position: fixed;
    inset: 56px auto 0 0;
    width: 275px;
    z-index: 1002;
    box-shadow: 20px 0 60px #30204a25;
  }
  .qa-history-mask {
    display: block;
    position: fixed;
    inset: 56px 0 0;
    border: 0;
    background: #27203533;
    z-index: 1001;
  }
  .qa-mobile {
    display: flex;
    padding: 6px;
  }
  .qa-chat-bar {
    min-height: 82px;
    padding: 10px 14px;
    align-items: flex-start;
  }
  .qa-chat-bar > div {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 4px 8px;
  }
  .qa-chat-bar h1 {
    font-size: 13px;
  }
  .qa-project {
    grid-column: 2;
    font-size: 11px;
  }
  .qa-project > span:first-child {
    display: none;
  }
  .qa-project :deep(.app-select) {
    width: 160px;
    font-size: 11px;
  }
  .qa-chat-bar > .button {
    font-size: 11px;
    padding: 6px 8px;
  }
  .qa-messages {
    padding: 20px 14px 8px;
  }
  .qa-message {
    gap: 8px;
    font-size: 13px;
  }
  .qa-message-content,
  .mine .qa-message-content {
    max-width: calc(100% - 42px);
  }
  .qa-message :deep(.reading-prose) {
    font-size: 13px;
  }
  .mine p {
    padding: 10px 13px;
  }
  .qa-composer-wrap {
    padding: 8px 12px;
  }
  .qa-composer {
    padding: 10px 12px;
    border-radius: 12px;
  }
  .qa-composer textarea {
    font-size: 13px;
    min-height: 57px;
  }
  .qa-composer-tools > div {
    gap: 6px;
  }
  .qa-composer-tools small {
    font-size: 9px;
  }
  .qa-composer-hint {
    font-size: 9px;
  }
  .qa-empty h2 {
    font-size: 23px;
  }
  .qa-session-delete {
    opacity: 1;
  }
  .qa-drawer-mask {
    top: 56px;
  }
}
</style>
