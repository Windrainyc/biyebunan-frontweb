<script setup lang="ts">
import AppSelect from '../components/AppSelect.vue';
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { auth, request, errorText } from '../api/client';
import { operation } from '../config/contract';
import { display } from '../config/labels';
import { metricTotal, type DashboardMetric } from '../config/dashboard-metrics';
import type { Page, Row } from '../types/api';
import Icon from '../components/Icon.vue';
import StatusBadge from '../components/StatusBadge.vue';
const props = defineProps<{ visiblePaths: string[] }>();
const daysCount = ref(7),
  loading = ref(false),
  error = ref('');
const metrics = ref<DashboardMetric[] | null>(null),
  orders = ref<Page<Row> | null>(null),
  projects = ref<Page<Row> | null>(null),
  students = ref<Page<Row> | null>(null);
const taskCounts = ref<Record<string, number | null>>({});
const todoDefinitions = [
  {
    key: 'reports',
    title: '论坛举报待处理',
    icon: 'shield',
    endpoint: '/admin/reports',
    query: { status: 'OPEN' },
    hint: '社区审核 · 尚未裁决的举报',
  },
  {
    key: 'posts',
    title: '论坛帖子待审核',
    icon: 'message',
    endpoint: '/admin/posts',
    query: { status: 'PENDING' },
    hint: '社区审核 · 等待发布审核',
  },
  {
    key: 'adjudications',
    title: '用量裁决待复核',
    icon: 'wallet',
    endpoint: '/admin/adjudications',
    query: { state: 'PENDING' },
    hint: '账务核对 · 需要独立复核人',
  },
  {
    key: 'jobs',
    title: '异步任务执行失败',
    icon: 'clock',
    endpoint: '/admin/jobs',
    query: { status: 'FAILED' },
    hint: '运行管理 · 按任务类型受控恢复',
  },
];
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const days = computed(() =>
  Array.from({ length: daysCount.value }, (_, i) =>
    new Date(
      Date.parse(today + 'T00:00:00+08:00') - (daysCount.value - i - 1) * 86400000,
    ).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }),
  ),
);
const can = (key: string, endpoint = `/${auth.platform}/${key}`) => {
  const op = operation('GET', endpoint);
  return (
    props.visiblePaths.includes(`/${auth.platform}/${key}`) &&
    !!op &&
    (!op.permission || auth.permissions.includes(op.permission))
  );
};
const todos = computed(() => todoDefinitions.filter((item) => can(item.key, item.endpoint)));
const quickLinks = computed(() =>
  [
    { key: 'orders', title: '订单管理', hint: '跟进订单与服务', icon: 'bag' },
    { key: 'projects', title: '项目交付', hint: '查看项目与交付', icon: 'folder' },
    { key: 'contents', title: '知识库内容', hint: '管理内容与发布', icon: 'book' },
    { key: 'users', title: '用户管理', hint: '查看用户与权限', icon: 'users' },
  ].filter((item) =>
    can(item.key, item.key === 'contents' ? '/admin/knowledge' : `/${auth.platform}/${item.key}`),
  ),
);
const total = (keys: string[], money = false) => metricTotal(metrics.value, keys, money);
const cards = computed(() => [
  {
    key: 'orders_created',
    title: `近${daysCount.value}日新增订单`,
    value: total(['orders_created']),
    icon: 'bag',
    unit: '笔',
  },
  {
    key: 'projects_created',
    title: `近${daysCount.value}日新增项目`,
    value: total(['projects_created']),
    icon: 'folder',
    unit: '个',
  },
  {
    key: 'delivery_publications',
    title: `近${daysCount.value}日交付发布`,
    value: total(['delivery_publications']),
    icon: 'file',
    unit: '次',
  },
  auth.platform === 'admin'
    ? {
        key: 'model_settled_tokens',
        title: `近${daysCount.value}日净入账词元`,
        value: total(['model_settled_tokens', 'model_correction_tokens']),
        icon: 'cpu',
        unit: '词元',
      }
    : {
        key: 'students',
        title: '名下学生',
        value: students.value?.total.toLocaleString('zh-CN') ?? '—',
        icon: 'users',
        unit: '人',
      },
]);
const series = computed(() =>
  days.value.map((day) => ({
    day,
    value:
      metrics.value
        ?.filter((m) => m.metric === 'orders_created' && m.bucket === day)
        .reduce((sum, m) => sum + Number(m.value), 0) || 0,
  })),
);
const max = computed(() => Math.max(1, ...series.value.map((item) => item.value)));
const points = computed(() =>
  series.value
    .map(
      (item, i) =>
        `${30 + (i * 600) / (days.value.length - 1)},${170 - (item.value / max.value) * 135}`,
    )
    .join(' '),
);
const labels = computed(() =>
  series.value.filter(
    (_, i) => i === 0 || i === days.value.length - 1 || i % Math.ceil(days.value.length / 7) === 0,
  ),
);
function spark(key: string) {
  const values = days.value.map(
    (day) =>
      metrics.value
        ?.filter(
          (m) =>
            m.bucket === day &&
            (m.metric === key ||
              (key === 'model_settled_tokens' && m.metric === 'model_correction_tokens')),
        )
        .reduce((sum, m) => sum + Number(m.value), 0) || 0,
  );
  const high = Math.max(1, ...values),
    low = Math.min(0, ...values);
  return values
    .map(
      (value, i) =>
        `${(i * 200) / (values.length - 1)},${20 - ((value - low) / (high - low)) * 18}`,
    )
    .join(' ');
}
let generation = 0;
onBeforeUnmount(() => generation++);
async function load() {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  metrics.value = null;
  orders.value = null;
  projects.value = null;
  students.value = null;
  taskCounts.value = {};
  const failures: string[] = [];
  const jobs: Promise<void>[] = [];
  async function read<T>(
    key: string,
    endpoint: string,
    query: Record<string, string | number | undefined>,
    apply: (data: T) => void,
  ) {
    if (!can(key, endpoint)) return;
    try {
      const result = await request<T>(endpoint, { query });
      if (current === generation) apply(result);
    } catch (e) {
      failures.push(errorText(e));
    }
  }
  jobs.push(
    read<{ items: DashboardMetric[] }>(
      'statistics',
      `/${auth.platform}/statistics`,
      { from: days.value[0]!, to: today },
      (data) => (metrics.value = data.items),
    ),
  );
  jobs.push(
    read<Page<Row>>(
      'orders',
      `/${auth.platform}/orders`,
      { page: 1, size: 4, sort: 'createdAt:desc' },
      (data) => (orders.value = data),
    ),
  );
  if (auth.platform === 'partner') {
    jobs.push(
      read<Page<Row>>(
        'projects',
        '/partner/projects',
        { page: 1, size: 5, sort: 'updatedAt:desc' },
        (data) => (projects.value = data),
      ),
    );
    jobs.push(
      read<Page<Row>>(
        'students',
        '/partner/students',
        { page: 1, size: 1 },
        (data) => (students.value = data),
      ),
    );
  } else {
    for (const task of todos.value)
      jobs.push(
        read<Page<Row>>(
          task.key,
          task.endpoint,
          { page: 1, size: 1, ...task.query },
          (data) => (taskCounts.value[task.key] = data.total),
        ),
      );
  }
  await Promise.all(jobs);
  if (current !== generation) return;
  loading.value = false;
  error.value = [...new Set(failures)].join('；');
}
watch(() => [...props.visiblePaths].sort().join('|'), load, { immediate: true });
</script>
<template>
  <section class="dashboard management-dashboard">
    <header v-if="auth.platform === 'admin'" class="dash-heading">
      <div>
        <p class="eyebrow">运营总览</p>
        <h1>欢迎回来，{{ auth.user?.displayName }}。</h1>
        <p class="muted">查看平台经营数据，跟进订单、项目与待处理事项。</p>
      </div>
      <div class="management-dash-actions">
        <label class="management-range"
          ><Icon name="calendar" /><AppSelect
            v-model.number="daysCount"
            aria-label="总览统计时间范围"
            :disabled="loading"
            @change="load"
          >
            <option :value="7">近7日</option>
            <option :value="30">近30日</option>
          </AppSelect></label
        ><RouterLink
          v-if="can('statistics') && visiblePaths.includes('/admin/exports')"
          class="button primary"
          to="/admin/exports"
          ><Icon name="file" />导出报告</RouterLink
        ><button class="button" :disabled="loading" @click="load" aria-label="刷新总览">
          <Icon name="refresh" />
        </button>
      </div>
    </header>
    <header v-else class="partner-welcome">
      <div>
        <p class="eyebrow">欢迎回来，{{ auth.user?.displayName }}</p>
        <h1>每个项目，都有清晰的下一步。</h1>
        <p>查看名下学生、跟进订单与交付进度，让每一次协作更有把握。</p>
      </div>
      <div class="partner-welcome-actions">
        <span><Icon name="calendar" /> {{ today }}</span
        ><button class="button" :disabled="loading" @click="load">
          <Icon name="refresh" />刷新工作概览
        </button>
      </div>
    </header>
    <p v-if="error" class="error" role="alert">
      {{ error }} <button class="button" @click="load">重试</button>
    </p>
    <p v-if="loading" class="muted" role="status">正在读取概览…</p>
    <div class="summary-grid">
      <article v-for="card in cards" :key="card.key" class="summary-card">
        <span>{{ card.title }}</span
        ><Icon :name="card.icon" variant="prism" /><strong>{{ card.value }}</strong
        ><small>{{ card.unit }}</small
        ><svg
          v-if="metrics !== null && card.key !== 'students'"
          class="summary-spark"
          viewBox="0 0 200 24"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            :points="spark(card.key)"
            fill="none"
            :stroke="auth.platform === 'admin' ? 'currentColor' : '#b9c7f5'"
            stroke-width="1.8"
          />
        </svg>
      </article>
    </div>
    <div v-if="auth.platform === 'admin'" class="management-dashboard-grid">
      <section class="management-panel">
        <header>
          <div>
            <h2>订单新增趋势</h2>
            <p>近{{ daysCount }}日 · 按北京时间自然日统计</p>
          </div>
          <span class="badge">订单数量</span>
        </header>
        <template v-if="metrics !== null"
          ><svg
            class="management-chart"
            viewBox="0 0 660 205"
            role="img"
            aria-label="新增订单趋势，日期和数量见图下方"
          >
            <defs>
              <linearGradient id="orders-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#e4dcfa" stop-opacity=".8" />
                <stop offset="100%" stop-color="#faf8ff" stop-opacity=".2" />
              </linearGradient>
            </defs>
            <line
              v-for="y in [35, 80, 125, 170]"
              :key="y"
              x1="30"
              x2="630"
              :y1="y"
              :y2="y"
              stroke="#e9edf5"
              stroke-dasharray="4 4"
            />
            <polygon :points="`30,170 ${points} 630,170`" fill="url(#orders-fill)" />
            <polyline :points="points" fill="none" stroke="#9b83d4" stroke-width="2.5" />
          </svg>
          <ol class="management-chart-labels">
            <li v-for="item in labels" :key="item.day">
              <span>{{ item.day.slice(5) }}</span
              ><b>{{ item.value }}</b>
            </li>
          </ol></template
        >
        <p v-else class="panel-empty">{{ loading ? '正在加载统计…' : '统计数据暂不可用' }}</p>
        <div class="management-chart-note">
          <Icon name="activity" />{{ days[0] }} — {{ today
          }}<RouterLink v-if="can('statistics')" to="/admin/statistics">查看完整统计</RouterLink>
        </div>
      </section>
      <section class="management-panel">
        <header>
          <div>
            <h2>待处理事项</h2>
            <p>按业务类型汇总当前待办</p>
          </div>
          <Icon name="clock" />
        </header>
        <RouterLink
          v-for="task in todos"
          :key="task.key"
          :to="{ path: `/admin/${task.key}`, query: task.query }"
          class="management-todo"
          ><Icon :name="task.icon" variant="prism" />
          <div>
            <strong>{{ task.title }}</strong
            ><small>{{ task.hint }}</small>
          </div>
          <span>{{ taskCounts[task.key] ?? '—' }}</span
          ><Icon name="right"
        /></RouterLink>
        <p v-if="!todos.length" class="panel-empty">当前账户暂无可见待办入口</p>
      </section>
      <nav v-if="quickLinks.length" class="admin-quick-links" aria-label="常用管理入口">
        <RouterLink v-for="link in quickLinks" :key="link.key" :to="`/admin/${link.key}`">
          <Icon :name="link.icon" />
          <div>
            <strong>{{ link.title }}</strong
            ><small>{{ link.hint }}</small>
          </div>
          <Icon name="right" />
        </RouterLink>
      </nav>
      <section class="management-panel admin-recent-orders">
        <header>
          <div>
            <h2>最近订单</h2>
            <p>最新创建的订单，最多显示4笔</p>
          </div>
          <RouterLink v-if="can('orders')" to="/admin/orders"
            >全部订单 <Icon name="right"
          /></RouterLink>
        </header>
        <div class="management-table-scroll">
          <table aria-label="最近订单">
            <thead>
              <tr>
                <th>订单 / 项目</th>
                <th>金额</th>
                <th>状态</th>
                <th>日期</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders?.items" :key="String(order.id)">
                <td>
                  <span class="cell-stack"
                    ><strong>{{ order.title }}</strong
                    ><small>{{ order.orderNo }}</small></span
                  >
                </td>
                <td>¥{{ order.amount }}</td>
                <td><StatusBadge :value="order.status" /></td>
                <td>{{ display(order.createdAt).split(' ')[0] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!orders?.items.length" class="panel-empty">
          {{ orders === null ? '暂未取得订单数据' : '暂无订单' }}
        </p>
      </section>
      <section class="management-panel">
        <header>
          <div>
            <h2>词元用量与费用</h2>
            <p>近{{ daysCount }}日 · 按实际入账统计</p>
          </div>
          <RouterLink v-if="can('usage')" to="/admin/usage"
            >计费详情 <Icon name="right"
          /></RouterLink>
        </header>
        <div class="management-token-total">
          <Icon name="cpu" />
          <div>
            <strong>{{ total(['model_settled_tokens', 'model_correction_tokens']) }}</strong
            ><small>净入账词元 · 含迟到用量更正</small>
          </div>
        </div>
        <dl class="management-token-details">
          <div>
            <dt>原结算金额</dt>
            <dd>¥{{ total(['model_settled_amount'], true) }}</dd>
          </div>
          <div>
            <dt>更正及人工调整</dt>
            <dd>¥{{ total(['model_correction_amount', 'model_adjustment_amount'], true) }}</dd>
          </div>
          <div>
            <dt>净入账金额</dt>
            <dd>
              ¥{{
                total(
                  ['model_settled_amount', 'model_correction_amount', 'model_adjustment_amount'],
                  true,
                )
              }}
            </dd>
          </div>
          <div>
            <dt>期间创建且尚待核对的调用</dt>
            <dd>{{ total(['model_unresolved_runs']) }} 次</dd>
          </div>
        </dl>
      </section>
    </div>
    <template v-else>
      <section class="management-panel">
        <header>
          <div>
            <h2>项目跟进</h2>
            <p>最近更新的5个项目，及时掌握交付进展</p>
          </div>
          <RouterLink v-if="can('projects')" to="/partner/projects"
            >全部项目 <Icon name="right"
          /></RouterLink>
        </header>
        <div class="management-table-scroll">
          <table aria-label="项目跟进">
            <thead>
              <tr>
                <th>项目名称</th>
                <th>当前阶段</th>
                <th>完成进度</th>
                <th>计划交付</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="project in projects?.items" :key="String(project.id)">
                <td>
                  <span class="cell-stack"
                    ><strong>{{ project.title }}</strong
                    ><small v-if="project.updatedAt"
                      >最近更新 {{ display(project.updatedAt) }}</small
                    ></span
                  >
                </td>
                <td><StatusBadge :value="project.stage" /></td>
                <td>
                  <progress
                    :value="Number(project.progress) || 0"
                    max="100"
                    aria-label="完成进度"
                  ></progress
                  >{{ project.progress }}%
                </td>
                <td>
                  {{ display(project.deliveryDate)
                  }}<small
                    v-if="
                      project.deliveryDate &&
                      String(project.deliveryDate).slice(0, 10) < today &&
                      project.stage !== 'DONE'
                    "
                    class="deadline-warning"
                    >已超过计划日期</small
                  >
                </td>
                <td>
                  <RouterLink
                    class="text-button"
                    :to="{ path: '/partner/projects', query: { view: String(project.id) } }"
                    >查看进度 <Icon name="right"
                  /></RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!projects?.items.length" class="panel-empty">
          {{ projects === null ? '暂未取得项目数据' : '暂无名下项目' }}
        </p>
      </section>
      <div class="partner-bottom-grid">
        <section class="management-panel">
          <header>
            <div>
              <h2>最近订单</h2>
              <p>关注新订单，及时完善服务资料</p>
            </div>
            <RouterLink v-if="can('orders')" to="/partner/orders"
              >查看全部 <Icon name="right"
            /></RouterLink>
          </header>
          <RouterLink
            v-for="order in orders?.items"
            :key="String(order.id)"
            :to="{ path: '/partner/orders', query: { view: String(order.id) } }"
            class="management-todo"
            ><Icon name="bag" />
            <div>
              <strong>{{ order.title }}</strong
              ><small>{{ order.orderNo }} · {{ display(order.createdAt) }}</small>
            </div>
            <StatusBadge :value="order.status"
          /></RouterLink>
          <p v-if="!orders?.items.length" class="panel-empty">
            {{ orders === null ? '暂未取得订单数据' : '暂无名下订单' }}
          </p>
        </section>
        <section class="management-panel">
          <header>
            <div>
              <h2>协作范围</h2>
              <p>专注于你负责的学生与项目</p>
            </div>
            <Icon name="shield" />
          </header>
          <div class="partner-scope">
            <p>查看名下学生信息、管理订单资料，跟进项目阶段与计划交付。</p>
            <p>学生私聊和交付文件由独立权限保护。需要调整项目内容时，请联系平台管理员协同处理。</p>
            <RouterLink
              v-if="visiblePaths.includes('/partner/profile')"
              class="button"
              to="/partner/profile"
              >我的账户 <Icon name="right"
            /></RouterLink>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.partner-welcome {
  padding: 24px;
  min-height: 0;
}
.partner-welcome h1 {
  font:
    650 24px/1.4 -apple-system,
    'PingFang SC',
    sans-serif;
}
.deadline-warning {
  display: block;
  color: #a14a22;
  margin-top: 5px;
}
</style>
