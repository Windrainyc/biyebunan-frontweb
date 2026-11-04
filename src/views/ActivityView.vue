<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { request, errorText } from '../api/client';
import { display } from '../config/labels';
import ReferenceField from '../components/ReferenceField.vue';
import DataChart from '../components/DataChart.vue';
import AppSelect from '../components/AppSelect.vue';

import type { Page } from '../types/api';
interface Event {
  id: string;
  displayName: string;
  platform: string;
  kind: string;
  path: string;
  contentTitle?: string;
  seconds: number;
  ip: string;
  location: string;
  createdAt: string;
}
interface Daily {
  day: string;
  loginUsers: number;
  logins: number;
  views: number;
  activeSeconds: number;
  learningSeconds: number;
}
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
const from = ref(today),
  to = ref(today),
  userId = ref<unknown>(''),
  kind = ref(''),
  page = ref(1),
  data = ref<Page<Event>>(),
  daily = ref<Daily[]>([]),
  busy = ref(false),
  error = ref('');
let generation = 0;
onBeforeUnmount(() => generation++);
async function load(reset = false) {
  if (reset) page.value = 1;
  const run = ++generation;
  busy.value = true;
  error.value = '';
  try {
    const query = {
      from: from.value,
      to: to.value,
      userId: userId.value || undefined,
      kind: kind.value || undefined,
    };
    const [list, summary] = await Promise.all([
      request<Page<Event>>('/admin/activity', { query: { ...query, page: page.value, size: 20 } }),
      request<Daily[]>('/admin/activity/summary', { query }),
    ]);
    if (run === generation) {
      data.value = list;
      daily.value = summary;
    }
  } catch (e) {
    if (run === generation) error.value = errorText(e);
  } finally {
    if (run === generation) busy.value = false;
  }
}
function activityName(path: string) {
  const names: Record<string, string> = {
    orders: '软件订单',
    software_order: '软件订单',
    projects: '软件项目',
    software_project: '软件项目',
    knowledge: '知识阅读',
    contents: '知识库内容',
    knowledge_content: '知识库内容',
    materials: '素材库',
    asset: '素材',
    statistics: '数据统计',
    activity: '用户活动',
    users: '用户管理',
    user_account: '用户管理',
    posts: '论坛',
    chat: '项目答疑',
    notifications: '消息中心',
    login: '登录',
    schools: '院校配置',
    majors: '专业配置',
    'service-packages': '服务套餐',
    service_package: '服务套餐',
    roles: '角色管理',
    menus: '菜单管理',
  };
  const actions: Record<string, string> = {
    CREATED: '新增',
    UPDATED: '修改',
    DELETED: '删除',
    PUBLISHED: '发布',
    CONFIRMED: '确认',
    STATE_CHANGED: '变更状态',
    STAGE_CHANGED: '推进阶段',
    ASSIGNED: '分配',
    WITHDRAWN: '撤回',
    BOUND: '绑定',
  };
  if (path.includes(' / ')) {
    const [entity, action] = path.split(' / ');
    return `${names[entity] || '业务记录'} · ${actions[action] || '处理'}`;
  }
  const parts = path.split('/').filter(Boolean);
  return (
    (names[parts[1]] || (parts.length === 1 ? '工作台' : '功能页面')) +
    (parts[2] === 'new' ? ' · 新增' : '')
  );
}
function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}
const totals = computed(() =>
  daily.value.reduce(
    (a, d) => ({
      logins: a.logins + d.logins,
      views: a.views + d.views,
      activeSeconds: a.activeSeconds + d.activeSeconds,
      learningSeconds: a.learningSeconds + d.learningSeconds,
    }),
    { logins: 0, views: 0, activeSeconds: 0, learningSeconds: 0 },
  ),
);
const chart = computed(() => ({
  color: ['#4b9bea', '#4fc6ae'],
  tooltip: { trigger: 'axis' },
  legend: { top: 0, bottom: 'auto', type: 'scroll', data: ['登录人数', '浏览次数'] },
  grid: { left: 45, right: 20, bottom: 35, top: 45 },
  xAxis: { type: 'category', data: daily.value.map((d) => d.day) },
  yAxis: { type: 'value', minInterval: 1 },
  series: [
    { name: '登录人数', type: 'bar', data: daily.value.map((d) => d.loginUsers) },
    { name: '浏览次数', type: 'line', data: daily.value.map((d) => d.views) },
  ],
}));
onMounted(() => load());
</script>
<template>
  <section class="activity-page">
    <h1>用户活动</h1>
    <p class="muted">
      按北京时间查询。仅记录功能上线后的真实访问；时长为可见且近期有交互的估算值，不作计费依据。
    </p>
    <form class="activity-filters" @submit.prevent="load(true)">
      <label>开始日期<input v-model="from" type="date" :max="to" required /></label
      ><label>结束日期<input v-model="to" type="date" :min="from" required /></label
      ><label
        >用户<ReferenceField
          v-model="userId"
          field="userId"
          dropdown
          placeholder="全部用户" /></label
      ><label
        >记录类型<AppSelect v-model="kind">
          <option value="">全部</option>
          <option value="LOGIN">登录</option>
          <option value="VIEW">页面访问与阅读</option>
          <option value="ACTION">业务操作</option>
        </AppSelect></label
      ><button class="button primary" :disabled="busy">查询</button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="busy" role="status">正在查询…</p>
    <div class="activity-metrics">
      <article>
        <span>登录次数</span><strong>{{ totals.logins }}</strong>
      </article>
      <article>
        <span>页面浏览次数</span><strong>{{ totals.views }}</strong>
      </article>
      <article>
        <span>活跃时长</span><strong>{{ duration(totals.activeSeconds) }}</strong>
      </article>
      <article>
        <span>知识学习时长</span><strong>{{ duration(totals.learningSeconds) }}</strong>
      </article>
    </div>
    <article class="activity-chart">
      <h2>访问趋势</h2>
      <DataChart :option="chart" label="每日登录人数与页面浏览次数趋势" />
    </article>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>用户 / 平台</th>
            <th>时间</th>
            <th>活动</th>
            <th>页面 / 知识</th>
            <th>活跃时长</th>
            <th>来源 IP / 地点</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.items" :key="row.id">
            <td>
              {{ row.displayName
              }}<small>{{
                { admin: '管理员', student: '学生', partner: '中介' }[row.platform] || row.platform
              }}</small>
            </td>
            <td>{{ display(row.createdAt) }}</td>
            <td>
              {{
                row.kind === 'ACTION'
                  ? '业务操作'
                  : row.kind === 'LOGIN'
                    ? '登录'
                    : row.contentTitle
                      ? '知识阅读'
                      : '页面访问'
              }}
            </td>
            <td>{{ row.contentTitle || activityName(row.path) }}</td>
            <td>{{ duration(row.seconds) }}</td>
            <td>
              {{ row.ip }}<small>{{ row.location }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="data && !data.total" class="empty">当前筛选下暂无活动记录</p>
    <div class="pager">
      <span>共 {{ data?.total || 0 }} 条 · 第 {{ page }} 页</span
      ><button
        class="button"
        :disabled="busy || page <= 1"
        @click="
          page--;
          load();
        "
      >
        上一页</button
      ><button
        class="button"
        :disabled="busy || page * 20 >= (data?.total || 0)"
        @click="
          page++;
          load();
        "
      >
        下一页
      </button>
    </div>
  </section>
</template>
<style scoped>
.activity-chart {
  background: white;
  border: 1px solid #e8ebf0;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}
.activity-chart h2 {
  font-size: 14px;
  margin: 0 0 18px;
}
.activity-page > .muted {
  font-size: 12px;
}
.table-scroll {
  background: white;
  border: 1px solid #e8ebf0;
  border-radius: 8px;
}
.activity-filters {
  background: white;
  border: 1px solid #e8ebf0;
  border-radius: 8px;
  padding: 16px;
}
.activity-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
  margin: 20px 0;
}
.activity-filters label {
  display: grid;
  gap: 6px;
  width: 180px;
  font-size: 13px;
}
.activity-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.activity-metrics article {
  padding: 16px;
  background: #fff;
  border: 1px solid #e8ebf0;
  border-radius: 8px;
}
.activity-metrics span,
small {
  display: block;
  font-size: 12px;
  color: #68778b;
}
.activity-metrics strong {
  display: block;
  font-size: 26px;
  margin-top: 8px;
}
.table-scroll {
  max-width: 100%;
  overflow: auto;
}
.table-scroll table {
  min-width: 880px;
  width: 100%;
  border-collapse: collapse;
}
.table-scroll td,
.table-scroll th {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e6ebf2;
  font-size: 13px;
}
.pager {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 16px;
  flex-wrap: wrap;
}
@media (max-width: 600px) {
  .activity-filters label {
    width: 100%;
  }
}
</style>
