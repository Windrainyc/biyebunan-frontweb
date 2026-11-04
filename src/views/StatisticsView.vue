<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed } from 'vue';
import { auth, request, errorText } from '../api/client';
import DataChart from '../components/DataChart.vue';
import { display } from '../config/labels';
interface Metric {
  metric: string;
  value: string;
  unit: string;
  bucket: string;
}
interface Statistics {
  from: string;
  to: string;
  generatedAt: string;
  lagSeconds: number;
  items: Metric[];
}
function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
const to = ref(today()),
  from = ref(today().slice(0, 8) + '01'),
  data = ref<Statistics | null>(null),
  error = ref(''),
  busy = ref(false);
const names: Record<string, string> = {
  orders_created: '新增订单',
  orders_face_amount: '订单面额',
  receipts_confirmed_amount: '确认收款金额',
  projects_created: '新增项目',
  delivery_publications: '交付发布次数',
  model_settled_amount: '模型结算金额',
  model_adjustment_amount: '模型调整金额',
  model_correction_tokens: '原调用词元更正',
  model_correction_amount: '原调用金额更正',
  model_settled_tokens: '已结算词元',
  model_unresolved_runs: '待核对模型调用',
  active_students: '活跃学生',
};
const units: Record<string, string> = {
  CNY: '元',
  TOKENS: '词元',
  COUNT: '次',
  count: '次',
  tokens: '词元',
  token: '词元',
  users: '人',
  orders: '笔',
};
function unit(metric: Metric) {
  if (metric.unit.toUpperCase() === 'COUNT') {
    return (
      (
        { active_students: '人', orders_created: '笔', projects_created: '个' } as Record<
          string,
          string
        >
      )[metric.metric] || '次'
    );
  }
  return units[metric.unit] || metric.unit;
}
const screen = ref<HTMLElement>();
const full = ref(false);
async function toggleFull() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await screen.value?.requestFullscreen();
  } catch {
    error.value = '当前浏览器不支持全屏，可使用浏览器全屏功能';
  }
}
function fullChanged() {
  full.value = !!document.fullscreenElement;
}
onMounted(() => document.addEventListener('fullscreenchange', fullChanged));
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', fullChanged));
const days = computed(() => {
  const out: string[] = [];
  const start = new Date((data.value?.from || from.value) + 'T00:00:00Z'),
    end = new Date((data.value?.to || to.value) + 'T00:00:00Z');
  for (let d = start; d <= end && out.length < 94; d = new Date(d.getTime() + 86400000))
    out.push(d.toISOString().slice(0, 10));
  return out;
});
const totals = computed(() => {
  const map = new Map<string, Metric>();
  for (const item of data.value?.items || []) {
    const old = map.get(item.metric);
    map.set(item.metric, {
      ...item,
      value: String(Number(old?.value || 0) + Number(item.value || 0)),
      bucket: '所选期间合计',
    });
  }
  return [...map.values()];
});
function chart(keys: string[], money = false) {
  return {
    color: ['#002fa7', '#42b3a0', '#e5ad55'],
    backgroundColor: 'transparent',
    textStyle: { color: '#7a8495' },
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      bottom: 'auto',
      type: 'scroll',
      textStyle: { color: '#7a8495' },
      data: keys.map((k) => names[k]),
    },
    grid: { left: money ? 65 : 45, right: 22, bottom: 35, top: 45 },
    xAxis: {
      type: 'category',
      axisLabel: { color: '#7a8495' },
      data: days.value,
      axisLine: { lineStyle: { color: '#e8ebf0' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#7a8495' },
      nameTextStyle: { color: '#7a8495' },
      minInterval: money ? undefined : 1,
      name: money ? '元' : '数量',
      splitLine: { lineStyle: { color: '#eef0f4' } },
    },
    series: keys.map((key) => ({
      name: names[key],
      type: money ? 'bar' : 'line',
      smooth: false,
      showSymbol: false,
      data: days.value.map((day) =>
        Number(data.value?.items.find((i) => i.metric === key && i.bucket === day)?.value || 0),
      ),
    })),
  };
}
const overview = computed(() =>
  ['orders_created', 'receipts_confirmed_amount', 'projects_created', 'delivery_publications'].map(
    (key) =>
      totals.value.find((item) => item.metric === key) || {
        metric: key,
        value: '0',
        unit: key.includes('amount') ? 'CNY' : 'COUNT',
        bucket: '所选期间合计',
      },
  ),
);
const otherTotals = computed(() =>
  totals.value.filter((item) => !overview.value.some((main) => main.metric === item.metric)),
);
const businessChart = computed(() =>
  chart(['orders_created', 'projects_created', 'delivery_publications']),
);
const moneyChart = computed(() => chart(['orders_face_amount', 'receipts_confirmed_amount'], true));
const activeChart = computed(() => chart(['active_students']));
let generation = 0;
onBeforeUnmount(() => {
  generation++;
});
async function load() {
  const current = ++generation;
  busy.value = true;
  data.value = null;
  error.value = '';
  try {
    const result = await request<Statistics>(`/${auth.platform}/statistics`, {
      query: { from: from.value, to: to.value },
    });
    if (current === generation) data.value = result;
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section ref="screen" class="statistics-screen">
    <header class="screen-heading">
      <div>
        <h1>数据统计</h1>
        <p class="muted">订单、收款与交付的业务概览 · 北京时间</p>
      </div>
      <form class="statistics-range" @submit.prevent="load">
        <input v-model="from" aria-label="开始日期" type="date" required :max="to" /><span>—</span
        ><input v-model="to" aria-label="结束日期" type="date" required :min="from" />
        <button class="button primary" :disabled="busy">查询</button
        ><button type="button" class="button" @click="toggleFull">
          {{ full ? '退出全屏' : '全屏查看' }}
        </button>
      </form>
    </header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="busy" class="muted">正在查询统计…</p>
    <p v-if="data" class="muted">
      生成时间：{{ display(data.generatedAt) }} · 数据延迟{{ data.lagSeconds }}秒
    </p>
    <div v-if="data" class="metric-grid">
      <article v-for="item in overview" :key="item.metric + item.bucket">
        <span>{{ names[item.metric] || '业务指标' }}</span
        ><strong
          >{{ Number(item.value).toLocaleString('zh-CN') }}<small>{{ unit(item) }}</small></strong
        >
        <p>{{ item.bucket }}</p>
      </article>
    </div>
    <div v-if="data" class="chart-grid">
      <article>
        <h2>订单与交付趋势</h2>
        <DataChart :option="businessChart" label="每日新增订单、项目和交付发布趋势" />
      </article>
      <article>
        <h2>订单面额与已记录收款</h2>
        <DataChart
          :option="moneyChart"
          label="每日订单面额与已填写收款金额，不包含未填写金额的核验"
        />
        <p class="chart-note">未填写金额的收款核验不计入金额；订单面额不等于实际收入。</p>
      </article>
      <article>
        <h2>活跃学生趋势</h2>
        <DataChart :option="activeChart" label="每日创建帖子、评论或答疑调用的去重学生人数" />
        <p class="chart-note">活跃学生按当日创建帖子、评论或答疑调用去重；跨日合计表示人日。</p>
      </article>
      <article>
        <h2>其他业务指标</h2>
        <div class="extra-metrics">
          <div v-for="item in otherTotals" :key="item.metric">
            <span>{{ names[item.metric] || '业务指标' }}</span
            ><strong
              >{{ Number(item.value).toLocaleString('zh-CN') }}
              <small>{{ unit(item) }}</small></strong
            >
          </div>
        </div>
        <p v-if="!otherTotals.length" class="muted">所选期间暂无其他业务指标</p>
      </article>
    </div>
    <p v-if="data && !data.items.length" class="empty">所选期间暂无统计数据</p>
  </section>
</template>
<style scoped>
.statistics-screen {
  min-width: 0;
  color: #182338;
}
.statistics-screen:fullscreen {
  overflow: auto;
  background: #f7f7f8;
  padding: 32px;
}
.screen-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.screen-heading h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}
.statistics-screen .muted,
.chart-note {
  color: #7a8495;
  font-size: 12px;
}
.screen-heading .muted {
  margin: 6px 0 0;
}
.statistics-range {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.statistics-range input {
  width: 145px;
  background: white;
  color: #455066;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin: 20px 0;
}
.metric-grid article,
.chart-grid article {
  background: white;
  border: 1px solid #e8ebf0;
  border-radius: 8px;
  padding: 20px;
  min-width: 0;
}
.metric-grid span {
  font-size: 12px;
  color: #7a8495;
}
.metric-grid strong {
  display: block;
  font-size: 28px;
  color: #182338;
  margin-top: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.metric-grid small {
  font-size: 12px;
  margin-left: 6px;
  color: #7a8495;
  font-weight: 400;
}
.metric-grid p {
  font-size: 11px;
  color: #98a0ad;
  margin: 8px 0 0;
}
.chart-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
}
.chart-grid h2 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 18px;
  color: #182338;
}
.chart-note {
  margin: 10px 0 0;
  line-height: 1.6;
}
.extra-metrics > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #eef0f4;
  font-size: 12px;
  color: #7a8495;
}
.extra-metrics strong {
  font-weight: 500;
  color: #182338;
}
.extra-metrics small {
  font-weight: 400;
}
@media (max-width: 1000px) {
  .chart-grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 700px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .metric-grid article {
    padding: 16px;
  }
  .statistics-range {
    width: 100%;
  }
  .statistics-range input {
    width: calc(50% - 20px);
  }
  .metric-grid strong {
    font-size: 24px;
  }
  .statistics-screen:fullscreen {
    padding: 16px;
  }
}
</style>
