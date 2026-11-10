<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { auth, errorText, request } from '../api/client';
import { operation } from '../config/contract';
import { display } from '../config/labels';
import type { Resource } from '../config/resources';
import type { Page, Row } from '../types/api';
import Icon from '../components/Icon.vue';
const props = defineProps<{ entries: Resource[]; visiblePaths: string[] }>();
interface Metric {
  metric: string;
  value: string;
  unit: string;
  bucket: string;
}
const metrics = ref<Metric[] | null>(null),
  projects = ref<Row[]>([]),
  loading = ref(true),
  error = ref('');
const pendingMilestones = computed(() =>
  milestones.value
    .filter((item) => !item.completed)
    .sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'))),
);
const projectLink = (section = 'overview') => ({
  path: '/student/projects',
  query: { view: String(project.value?.id || ''), section },
});
const milestones = ref<Row[]>([]),
  deliveries = ref<Row[]>([]),
  community = ref<Row[]>([]),
  learning = ref<Row[]>([]);
let generation = 0;
const now = new Date();
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(now);
const days = Array.from({ length: 7 }, (_, index) =>
  new Date(Date.parse(today + 'T00:00:00+08:00') - (6 - index) * 86400000).toLocaleDateString(
    'en-CA',
    { timeZone: 'Asia/Shanghai' },
  ),
);
const canRead = (path: string) => {
  const op = operation('GET', path);
  return !!op && (!op.permission || auth.permissions.includes(op.permission));
};
const visible = (name: string) => props.visiblePaths.includes(`/${auth.platform}/${name}`);
async function load() {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  metrics.value = null;
  projects.value = [];
  milestones.value = [];
  deliveries.value = [];
  community.value = [];
  learning.value = [];
  const statsPath = `/${auth.platform}/statistics`,
    projectPath = `/${auth.platform}/projects`;
  const results = await Promise.allSettled([
    canRead(statsPath)
      ? request<{ items: Metric[] }>(statsPath, { query: { from: days[0], to: today } })
      : Promise.resolve(null),
    canRead(projectPath)
      ? request<Page<Row>>(projectPath, { query: { page: 1, size: 5, sort: 'updatedAt:desc' } })
      : Promise.resolve(null),
  ]);
  if (current !== generation) return;
  const stats = results[0],
    projectResult = results[1];
  if (stats.status === 'fulfilled') metrics.value = stats.value?.items || null;
  if (projectResult.status === 'fulfilled') projects.value = projectResult.value?.items || [];
  error.value = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => errorText(r.reason))
    .join('；');
  if (auth.platform === 'student') {
    const chosen = project.value;
    const sections = await Promise.allSettled([
      chosen
        ? request<Page<Row>>(`/student/projects/${chosen.id}/milestones`, {
            query: { page: 1, size: 4 },
          })
        : Promise.resolve(null),
      chosen
        ? request<Page<Row>>(`/student/projects/${chosen.id}/deliveries`, {
            query: { page: 1, size: 4 },
          })
        : Promise.resolve(null),
      request<Page<Row>>('/student/posts', { query: { page: 1, size: 3 } }),
      request<Page<Row>>('/student/knowledge', { query: { page: 1, size: 3 } }),
    ]);
    if (current !== generation) return;
    [milestones, deliveries, community, learning].forEach((target, index) => {
      const result = sections[index];
      if (result.status === 'fulfilled') target.value = result.value?.items || [];
    });
    const sectionErrors = sections
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => errorText(r.reason));
    if (sectionErrors.length)
      error.value = [error.value, ...sectionErrors].filter(Boolean).join('；');
  }
  loading.value = false;
}
const cards = computed(() => [
  { key: 'orders_created', title: '近7日新增订单', icon: 'bag', unit: '笔' },
  { key: 'projects_created', title: '近7日新增项目', icon: 'folder', unit: '个' },
  { key: 'delivery_publications', title: '近7日交付发布', icon: 'file', unit: '次' },
  ...(auth.platform === 'partner'
    ? []
    : [{ key: 'model_settled_tokens', title: '近7日净入账词元', icon: 'cpu', unit: '词元' }]),
]);
function total(key: string) {
  return metrics.value === null
    ? '—'
    : metrics.value
        .filter(
          (m) =>
            m.metric === key ||
            (key === 'model_settled_tokens' && m.metric === 'model_correction_tokens'),
        )
        .reduce((sum, m) => sum + BigInt(m.value), 0n)
        .toLocaleString('zh-CN');
}
const project = computed(
  () =>
    projects.value.find((p) => !['DONE', 'PAUSED'].includes(String(p.stage))) || projects.value[0],
);
const progress = computed(() => Math.max(0, Math.min(100, Number(project.value?.progress) || 0)));
const stages = [
  'PENDING',
  'REQUIREMENTS',
  'PROPOSAL',
  'DEVELOPMENT',
  'DOCUMENTATION',
  'ACCEPTANCE',
  'DONE',
];
const stageIndex = computed(() => stages.indexOf(String(project.value?.stage)));
const series = computed(() =>
  days.map((day) => ({
    day,
    value:
      metrics.value
        ?.filter((m) => m.metric === 'orders_created' && m.bucket === day)
        .reduce((sum, m) => sum + Number(m.value), 0) || 0,
  })),
);
const maxValue = computed(() => Math.max(1, ...series.value.map((p) => p.value)));
const points = computed(() =>
  series.value.map((p, i) => `${30 + i * 100},${170 - (p.value / maxValue.value) * 135}`).join(' '),
);
const availableEntries = computed(() => props.entries.slice(0, 6));
onMounted(load);
onBeforeUnmount(() => generation++);
</script>
<template>
  <section class="dashboard">
    <header class="dash-heading">
      <div>
        <p class="eyebrow">
          {{
            auth.platform === 'student'
              ? '让想法发生 · YOUR CREATIVE SPACE'
              : auth.platform === 'partner'
                ? '项目协作概览'
                : '运营总览'
          }}
        </p>
        <h1>欢迎回来，{{ auth.user?.displayName }}。</h1>
        <p class="muted">
          {{
            auth.platform === 'student'
              ? '新的一天，从一个好想法开始。一起让项目更进一步。'
              : '跟进订单、项目与交付进展。'
          }}
        </p>
      </div>
      <div class="date">
        <Icon name="calendar" />{{ today
        }}<button class="button" :disabled="loading" @click="load">
          <Icon name="refresh" />刷新
        </button>
      </div>
    </header>
    <p v-if="error" class="error" role="alert">
      {{ error }} <button class="button" @click="load">重试</button>
    </p>
    <div v-if="auth.platform !== 'student'" class="summary-grid">
      <article v-for="card in cards" :key="card.key" class="summary-card">
        <span>{{ card.title }}</span
        ><Icon :name="card.icon" variant="prism" /><strong>{{ total(card.key) }}</strong
        ><small>{{ card.unit }}</small>
      </article>
    </div>
    <article v-if="auth.platform === 'student' && project" class="project-hero">
      <div class="hero-top">
        <span>最近项目</span><span class="stage-pill">{{ display(project.stage) }}</span>
      </div>
      <h2>{{ project.title }}</h2>
      <div class="student-hero-art" aria-hidden="true">
        <span class="orbit orbit-one"></span><span class="orbit orbit-two"></span
        ><Icon name="folder" /><span class="orbit-spark">✦</span>
      </div>
      <p class="hero-date"><Icon name="calendar" />计划交付 {{ display(project.deliveryDate) }}</p>
      <ol class="stages">
        <li
          v-for="(stage, index) in stages"
          :key="stage"
          :class="{ reached: index <= stageIndex, current: index === stageIndex }"
        >
          <span></span>{{ display(stage) }}
        </li>
      </ol>
      <div class="hero-actions">
        <RouterLink v-if="visible('projects')" class="button" :to="projectLink()"
          >查看项目<Icon name="right" /></RouterLink
        ><RouterLink v-if="visible('chat')" class="button ghost" to="/student/chat"
          ><Icon name="sparkles" />打开智能答疑</RouterLink
        >
      </div>
      <div class="progress-line">
        <span>项目阶段进度</span
        ><progress :value="progress" max="100" :aria-label="`项目阶段进度${progress}%`"></progress
        ><span>{{ progress }}%</span>
      </div>
    </article>
    <article v-else-if="auth.platform === 'student' && !loading" class="empty-project card">
      <Icon name="folder" />
      <h2>暂无可展示的项目</h2>
      <p>绑定订单后，可在这里查看项目进度和交付资料。</p>
      <RouterLink v-if="visible('bind-order')" class="button primary" to="/student/bind-order"
        >绑定订单</RouterLink
      >
    </article>
    <p v-if="loading" class="muted" role="status">正在读取工作台数据…</p>
    <section v-if="auth.platform === 'student'" class="student-overview-panel student-task-panel">
      <header>
        <h2>接下来要做</h2>
        <RouterLink :to="projectLink('milestones')">项目里程碑 <Icon name="right" /></RouterLink>
      </header>
      <div v-for="item in pendingMilestones" :key="String(item.id)" class="student-overview-row">
        <Icon :name="item.completed ? 'check' : 'clock'" />
        <div>
          <strong>{{ item.name }}</strong
          ><small>{{ item.completed ? '已完成' : '待完成' }} · {{ display(item.dueDate) }}</small>
        </div>
      </div>
      <p v-if="!pendingMilestones.length" class="muted">
        {{ loading ? '正在读取里程碑…' : '当前已加载里程碑中没有待办' }}
      </p>
    </section>
    <div class="dashboard-columns">
      <section v-if="auth.platform === 'student'" class="student-tools-section">
        <div class="section-heading">
          <h2>让每一步，都更轻松</h2>
          <span>你的项目学习工具箱</span>
        </div>
        <div class="student-tools-grid">
          <RouterLink v-if="visible('chat')" to="/student/chat" class="student-tool-card tool-ai">
            <Icon name="sparkles" />
            <h3>智能答疑</h3>
            <p>遇到问题不用停下来，让灵感继续。</p>
            <span>开始一段对话 <Icon name="right" /></span>
          </RouterLink>
          <RouterLink
            v-if="visible('knowledge')"
            to="/student/knowledge"
            class="student-tool-card tool-knowledge"
          >
            <Icon name="file" />
            <h3>知识资料</h3>
            <p>从概念到实践，找到你需要的参考。</p>
            <span>探索知识库 <Icon name="right" /></span>
          </RouterLink>
          <RouterLink
            v-if="visible('posts')"
            to="/student/posts"
            class="student-tool-card tool-community"
          >
            <Icon name="message" />
            <h3>交流广场</h3>
            <p>分享经验，也听听其他人的想法。</p>
            <span>看看大家在聊什么 <Icon name="right" /></span>
          </RouterLink>
        </div>
      </section>
      <section v-else class="chart-card card">
        <div class="section-heading">
          <h2>订单新增趋势</h2>
          <span>近7日 · 笔</span>
        </div>
        <template v-if="metrics !== null"
          ><svg
            viewBox="0 0 660 205"
            role="img"
            aria-label="近7日新增订单趋势，具体数值见下方日期列表"
          >
            <line x1="30" y1="170" x2="630" y2="170" stroke="#dde2ed" />
            <polyline :points="points" fill="none" stroke="#4b51c5" stroke-width="3" />
            <circle
              v-for="(point, index) in series"
              :key="point.day"
              :cx="30 + index * 100"
              :cy="170 - (point.value / maxValue) * 135"
              r="4"
              fill="#4b51c5"
            />
          </svg>
          <ol class="chart-values">
            <li v-for="point in series" :key="point.day">
              <span>{{ point.day.slice(5) }}</span
              ><b>{{ point.value }}</b>
            </li>
          </ol></template
        >
        <p v-else class="muted">{{ loading ? '正在加载统计…' : '当前未取得统计数据' }}</p>
      </section>
      <section v-if="auth.platform !== 'student'" class="quick-card card">
        <div class="section-heading"><h2>常用功能</h2></div>
        <RouterLink
          v-for="entry in availableEntries"
          :key="entry.key"
          :to="`/${auth.platform}/${entry.key}`"
          ><Icon :name="entry.icon" variant="prism" /><span>{{ entry.title }}</span
          ><Icon name="right"
        /></RouterLink>
        <p v-if="!availableEntries.length" class="muted">暂无可用导航，请联系管理员配置。</p>
      </section>
    </div>
    <template v-if="auth.platform === 'student'">
      <section class="student-overview-panel">
        <header>
          <h2>项目交付物</h2>
          <RouterLink :to="projectLink('deliveries')">全部 <Icon name="right" /></RouterLink>
        </header>
        <RouterLink
          v-for="item in deliveries"
          :key="String(item.id)"
          :to="projectLink('deliveries')"
          class="student-overview-row"
          ><Icon name="file" />
          <div>
            <strong>{{ item.title || item.name || display(item.kind) }}</strong
            ><small>{{ display(item.updatedAt || item.createdAt) }}</small>
          </div></RouterLink
        >
        <p v-if="!deliveries.length" class="muted">
          {{ loading ? '正在读取交付物…' : '当前项目暂无已发布交付物' }}
        </p>
      </section>
      <section class="student-overview-panel">
        <header>
          <h2>答疑动态</h2>
          <RouterLink to="/student/posts">去广场 <Icon name="right" /></RouterLink>
        </header>
        <RouterLink
          v-for="item in community"
          :key="String(item.id)"
          :to="{ path: '/student/posts', query: { view: String(item.id) } }"
          class="student-overview-row"
          ><Icon name="message" />
          <div>
            <strong>{{ item.title }}</strong
            ><small>{{ display(item.createdAt) }}</small>
          </div></RouterLink
        >
        <p v-if="!community.length" class="muted">
          {{ loading ? '正在读取讨论…' : '暂无可访问的讨论' }}
        </p>
      </section>
      <section class="student-learning">
        <div>
          <p class="eyebrow">学习内容</p>
          <h2>继续探索，<br />让项目更进一步。</h2>
          <p class="muted">浏览当前可访问的知识资料</p>
        </div>
        <RouterLink
          v-for="item in learning"
          :key="String(item.id)"
          :to="{ path: '/student/knowledge', query: { view: String(item.id) } }"
          ><small>{{ display(item.type) }}</small>
          <h3>{{ item.title }}</h3>
          <span>阅读资料 <Icon name="right" /></span
        ></RouterLink>
        <p v-if="!learning.length" class="muted">
          {{ loading ? '正在读取资料…' : '暂无可访问的知识资料' }}
        </p>
      </section>
    </template>
  </section>
</template>
<style scoped>
.dash-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 24px;
  margin-bottom: 28px;
}
.eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: #667086;
}
.eyebrow::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 10px;
  border-radius: 50%;
  background: #df8c78;
}
h1 {
  font-family: 'Songti SC', 'Noto Serif SC', serif;
  font-size: 34px;
  font-weight: 500;
  margin: 12px 0;
}
h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
.date {
  display: flex;
  gap: 12px;
  align-items: center;
  white-space: nowrap;
  color: #687185;
  font-size: 13px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 16px;
  margin: 24px 0;
}
.summary-card {
  position: relative;
  background: white;
  border: 1px solid #e8eaf1;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 4px #17233b03;
}
.summary-card > span {
  display: block;
  font-size: 12px;
  color: #737b8e;
  margin-bottom: 20px;
}
.summary-card > .ali-icon {
  position: absolute;
  right: 18px;
  top: 18px;
  background: #efeffb;
  color: #5355ba;
  padding: 8px;
  border-radius: 10px;
}
.summary-card strong {
  font-family: 'Songti SC', serif;
  font-size: 32px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.summary-card small {
  margin-left: 8px;
  color: #7a8290;
}
.project-hero {
  background:
    radial-gradient(ellipse at top right, #3e4a8a, transparent 60%),
    linear-gradient(120deg, #15213b, #27335c);
  color: white;
  border-radius: 22px;
  padding: 30px;
  box-shadow: 0 16px 28px #1d29411c;
  margin: 24px 0;
}
.hero-top {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #bdc5de;
}
.stage-pill {
  padding: 6px 12px;
  border: 1px solid #8f9dc14d;
  border-radius: 20px;
  background: #ffffff0c;
}
.project-hero h2 {
  font-family: 'Songti SC', serif;
  font-size: 28px;
  max-width: 650px;
  margin: 24px 0 16px;
  line-height: 1.5;
  font-weight: 500;
}
.hero-date {
  font-size: 12px;
  color: #b9c3da;
  display: flex;
  gap: 8px;
}
.stages {
  display: flex;
  padding: 16px 0 0;
  list-style: none;
  margin: 24px 0;
}
.stages li {
  position: relative;
  flex: 1;
  border-top: 2px solid #ffffff26;
  padding-top: 16px;
  font-size: 11px;
  color: #8e9ab7;
}
.stages li span {
  position: absolute;
  left: 0;
  top: -4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #697598;
}
.stages li.reached {
  border-color: #909cd1;
  color: #c3cbed;
}
.stages li.current {
  color: #ffcab5;
}
.stages li.current span {
  background: #e9a18a;
  box-shadow: 0 0 0 6px #e9a18a20;
}
.hero-actions {
  display: flex;
  gap: 12px;
  margin-top: 28px;
}
.hero-actions .button {
  background: white;
  color: #25314e;
}
.hero-actions .ghost {
  background: #ffffff15;
  color: white;
  border-color: #ffffff26;
}
.progress-line {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 22px;
  font-size: 11px;
  color: #bec8dd;
}
.progress-line progress {
  width: 150px;
  height: 5px;
  accent-color: #e9a18a;
}
.dashboard-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(250px, 1fr);
  gap: 18px;
  margin: 24px 0;
}
.chart-card,
.quick-card,
.assistant-card {
  padding: 24px;
  border-radius: 18px;
  border: 1px solid #e6e9f0;
  background: white;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.section-heading span {
  font-size: 12px;
  color: #788197;
}
.chart-card svg {
  display: block;
  width: 100%;
  height: auto;
}
.chart-values {
  display: flex;
  justify-content: space-between;
  list-style: none;
  padding: 0;
  margin: 0 15px;
  font-size: 11px;
  color: #778096;
}
.chart-values li {
  display: grid;
  gap: 6px;
  text-align: center;
}
.chart-values b {
  color: #343d56;
}
.quick-card > a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #f0f1f6;
  color: #3b465d;
  text-decoration: none;
  font-size: 13px;
}
.quick-card > a > .ali-icon:first-child {
  background: #f1f1fb;
  color: #575fba;
  padding: 8px;
  border-radius: 8px;
}
.quick-card > a > .ali-icon:last-child {
  margin-left: auto;
}
.assistant-card {
  background: linear-gradient(110deg, #fff 40%, #e7e8fb);
  padding: 30px;
}
.assistant-card > .ali-icon {
  display: inline-block;
  background: #17213a;
  color: white;
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 18px;
}
.assistant-card p {
  font-size: 14px;
  line-height: 1.9;
  color: #69758a;
  max-width: 520px;
}
.assistant-links {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
.empty-project {
  padding: 28px;
  margin: 24px 0;
}
.empty-project h2 {
  margin: 12px 0;
}
@media (max-width: 850px) {
  .dash-heading {
    display: block;
  }
  .date {
    margin-top: 18px;
  }
  .dashboard-columns {
    grid-template-columns: 1fr;
  }
  .project-hero {
    padding: 22px;
  }
  .stages {
    gap: 0;
  }
  .stages li {
    font-size: 10px;
  }
  h1 {
    font-size: 28px;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto;
  }
}
</style>
