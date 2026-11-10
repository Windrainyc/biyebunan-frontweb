<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed, ref, onBeforeUnmount, watch } from 'vue';
import { request, errorText } from '../api/client';
import { display } from '../config/labels';
import type { Row, Page } from '../types/api';
import Icon from './Icon.vue';
import StatusBadge from './StatusBadge.vue';
import RequirementAttachments from './RequirementAttachments.vue';
import ProjectDetail from './ProjectDetail.vue';
import RecordActions from './RecordActions.vue';
const props = defineProps<{ project: Row }>();
const emit = defineEmits<{ back: []; changed: [result: Row]; refresh: [] }>();
const route = useRoute();
const tab = ref(
  ['overview', 'deliveries', 'qa'].includes(String(route.query.section))
    ? String(route.query.section)
    : 'deliveries',
);
const tabs = [
  { key: 'overview', label: '项目概览' },
  { key: 'deliveries', label: '版本与交付' },
  { key: 'qa', label: '答疑记录' },
];
const stages = [
  'PENDING',
  'REQUIREMENTS',
  'PROPOSAL',
  'DEVELOPMENT',
  'DOCUMENTATION',
  'ACCEPTANCE',
  'DONE',
];
const currentStage = computed(() => stages.indexOf(String(props.project.stage)));
const progress = computed(() => Math.max(0, Math.min(100, Number(props.project.progress) || 0)));
const conversations = ref<Row[]>([]),
  page = ref(0),
  total = ref(0),
  loading = ref(false),
  error = ref('');
let generation = 0;
onBeforeUnmount(() => generation++);
async function loadConversations() {
  if (loading.value) return;
  const current = generation;
  loading.value = true;
  error.value = '';
  try {
    const result = await request<Page<Row>>('/student/conversations', {
      query: { page: page.value + 1, size: 20, sort: 'updatedAt:desc' },
    });
    if (current !== generation) return;
    const seen = new Set(conversations.value.map((row) => row.id));
    conversations.value.push(
      ...result.items.filter((row) => row.projectId === props.project.id && !seen.has(row.id)),
    );
    page.value++;
    total.value = result.total;
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) loading.value = false;
  }
}
watch(tab, (value) => {
  if (value === 'qa' && page.value === 0) void loadConversations();
});
function keyboardTab(event: KeyboardEvent, index: number) {
  const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (!direction && !['Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + direction + tabs.length) % tabs.length;
  tab.value = tabs[next]!.key;
  (event.currentTarget as HTMLElement).parentElement
    ?.querySelectorAll<HTMLButtonElement>('button')
    [next]?.focus();
}
</script>
<template>
  <section class="student-project-space">
    <button class="text-button project-back" @click="emit('back')">
      <Icon name="left" />返回项目列表
    </button>
    <header>
      <div>
        <p class="eyebrow">项目空间</p>
        <h1>{{ project.title }}</h1>
        <p class="muted">
          <Icon name="calendar" />计划交付 {{ display(project.deliveryDate) }}
          <span>·</span> 最近更新 {{ display(project.updatedAt) }}
        </p>
      </div>
      <RouterLink
        :to="{ path: '/student/chat', query: { projectId: String(project.id) } }"
        class="button primary"
        ><Icon name="sparkles" />智能答疑</RouterLink
      >
    </header>
    <section class="project-progress-overview" aria-label="项目进度">
      <div>
        <div class="project-progress-caption">
          <strong>{{ progress }}%</strong><span>项目阶段进度</span
          ><StatusBadge :value="project.stage" />
        </div>
        <ol class="project-stage-track">
          <li
            v-for="(stage, index) in stages"
            :key="stage"
            :class="{ done: index < currentStage, current: index === currentStage }"
          >
            <span></span>{{ display(stage) }}
          </li>
        </ol>
      </div>
      <div class="project-deadline">
        <small>计划交付日期</small><strong>{{ display(project.deliveryDate) }}</strong
        ><span>以项目最新计划为准</span>
      </div>
    </section>
    <div class="project-tabs" role="tablist" aria-label="项目内容">
      <button
        v-for="(item, index) in tabs"
        :id="'project-tab-' + item.key"
        :key="item.key"
        role="tab"
        :aria-selected="tab === item.key"
        :aria-controls="'project-panel-' + item.key"
        :tabindex="tab === item.key ? 0 : -1"
        :class="{ active: tab === item.key }"
        @click="tab = item.key"
        @keydown="keyboardTab($event, index)"
      >
        {{ item.label }}
      </button>
    </div>
    <div class="project-detail-layout">
      <section
        :id="'project-panel-' + tab"
        class="project-main-panel"
        role="tabpanel"
        :aria-labelledby="'project-tab-' + tab"
      >
        <template v-if="tab === 'overview'"
          ><div class="project-panel-heading">
            <h2>项目概览</h2>
            <p>项目资料和进度集中在这里，最新交付版本随时可查。</p>
          </div>
          <dl class="project-overview-fields">
            <div>
              <dt>项目名称</dt>
              <dd>{{ project.title }}</dd>
            </div>
            <div>
              <dt>当前阶段</dt>
              <dd><StatusBadge :value="project.stage" /></dd>
            </div>
            <div>
              <dt>计划交付</dt>
              <dd>{{ display(project.deliveryDate) }}</dd>
            </div>
            <div>
              <dt>完成进度</dt>
              <dd>{{ progress }}%</dd>
            </div>
          </dl>
          <p v-if="project.requirements" class="project-description">{{ project.requirements }}</p>
          <RequirementAttachments :ids="project.requirementAssetIds" />
          <div class="project-panel-actions">
            <button class="button" @click="tab = 'deliveries'">
              <Icon name="file" />查看交付物
            </button>
          </div>
          <RecordActions
            resource-key="projects"
            :record="project"
            @changed="emit('changed', $event)"
        /></template>
        <template v-else-if="tab === 'qa'"
          ><div class="project-panel-heading">
            <h2>项目答疑记录</h2>
            <p>查看与当前项目关联的提问和回答，继续上一次讨论。</p>
          </div>
          <p v-if="error" class="error" role="alert">
            {{ error }} <button class="button" @click="loadConversations">重试</button>
          </p>
          <p v-if="loading" class="muted" role="status">正在查找项目会话…</p>
          <RouterLink
            v-for="item in conversations"
            :key="String(item.id)"
            :to="{ path: '/student/chat', query: { conversationId: String(item.id) } }"
            class="project-conversation"
            ><Icon name="message" />
            <div>
              <strong>{{ item.title }}</strong
              ><small>{{ display(item.updatedAt) }}</small>
            </div>
            <Icon name="right"
          /></RouterLink>
          <p v-if="!loading && !error && !conversations.length" class="muted">
            {{
              page * 20 >= total
                ? '当前项目暂无答疑记录'
                : '已读取的会话中暂无当前项目记录，可继续加载。'
            }}
          </p>
          <div class="project-panel-actions">
            <span class="muted">已找到 {{ conversations.length }} 条项目会话</span
            ><button
              v-if="page * 20 < total"
              class="button"
              :disabled="loading"
              @click="loadConversations"
            >
              {{ loading ? '加载中…' : '继续加载会话' }}
            </button>
          </div></template
        >
        <ProjectDetail v-else :project="project" section="deliveries" @changed="emit('refresh')" />
      </section>
      <aside class="project-side-panels">
        <section class="project-side-card">
          <h3>当前项目</h3>
          <p>{{ project.title }}</p>
          <p>当前阶段：<StatusBadge :value="project.stage" /></p>
          <p>计划交付：{{ display(project.deliveryDate) }}</p>
          <p>完成进度：{{ progress }}%</p>
        </section>
        <section class="project-side-assistant">
          <Icon name="sparkles" />
          <h3>卡在哪个环节？</h3>
          <p>带着具体问题进入智能答疑，围绕当前项目继续交流。</p>
          <RouterLink
            :to="{ path: '/student/chat', query: { projectId: String(project.id) } }"
            class="button primary"
            >基于项目提问 <Icon name="right"
          /></RouterLink>
        </section>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.project-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  height: 32px;
  padding: 0 10px;
  margin: 0 0 16px;
  font-size: 13px;
  color: #536783;
  border: 0;
  background: transparent;
}
.project-back:hover {
  background: #eaf3ff;
}
</style>
