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
  const start = new Date(from.value + 'T00:00:00Z'),
    end = new Date(to.value + 'T00:00:00Z');
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
    color: ['#69bbff', '#55d7ba', '#ffc879'],
    backgroundColor: 'transparent',
    textStyle: { color: '#b7cbe0' },
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#b7cbe0' }, data: keys.map((k) => names[k]) },
    grid: { left: money ? 65 : 45, right: 22, bottom: 35, top: 45 },
    xAxis: {
      type: 'category',
      axisLabel: { color: '#b7cbe0' },
      data: days.value,
      axisLine: { lineStyle: { color: '#36516d' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#b7cbe0' },
      nameTextStyle: { color: '#b7cbe0' },
      minInterval: money ? undefined : 1,
      name: money ? '元' : '数量',
      splitLine: { lineStyle: { color: '#203a53' } },
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
        <p class="screen-kicker">知项 · 运营数据</p>
        <h1>数据统计</h1>
      </div>
      <button class="button" @click="toggleFull">{{ full ? '退出全屏' : '全屏查看' }}</button>
    </header>
    <p class="muted">
      按北京时间自然日查询，只展示实际产生的数据。<template v-if="auth.platform !== 'partner'"
        >未知模型费用单独统计。</template
      >
    </p>
    <form class="filters" @submit.prevent="load">
      <label>开始日期<input v-model="from" type="date" required :max="to" /></label
      ><label>结束日期<input v-model="to" type="date" required :min="from" /></label
      ><button class="button primary" :disabled="busy">查询统计</button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="busy" class="muted">正在查询统计…</p>
    <p v-if="data" class="muted">
      生成时间：{{ display(data.generatedAt) }} · 数据延迟{{ data.lagSeconds }}秒
    </p>
    <div class="metric-grid">
      <article v-for="item in totals" :key="item.metric + item.bucket">
        <span>{{ names[item.metric] || '业务指标' }}</span
        ><strong
          >{{ item.value }}<small>{{ unit(item) }}</small></strong
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
      <article class="chart-wide">
        <h2>活跃学生趋势</h2>
        <DataChart :option="activeChart" label="每日创建帖子、评论或答疑调用的去重学生人数" />
        <p class="chart-note">活跃学生按当日创建帖子、评论或答疑调用去重；跨日合计表示人日。</p>
      </article>
    </div>
    <p v-if="data && !data.items.length" class="empty">所选期间暂无统计数据</p>
  </section>
</template>
<style scoped>
.statistics-screen {
  background: #0e2034;
  color: #e6f2ff;
  padding: 24px;
  border: 1px solid #29445e;
  border-radius: 12px;
  min-width: 0;
}
.statistics-screen:fullscreen {
  overflow: auto;
  border-radius: 0;
  padding: 32px;
}
.screen-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.screen-kicker {
  font-size: 11px;
  letter-spacing: 2px;
  color: #74bfff;
  margin: 0 0 8px;
}
.screen-heading h1 {
  color: #edf7ff;
  margin: 0;
}
.statistics-screen .muted,
.chart-note {
  color: #9cb6d0;
  font-size: 12px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
  margin: 22px 0;
}
.statistics-screen .button.primary {
  color: #173c66;
  background: #b9dcff;
  border-color: #8cc4f3;
}
.filters label {
  display: grid;
  gap: 6px;
  font-size: 13px;
}
.filters input {
  color: #d7eaff;
  background: #172e46;
  border-color: #36516d;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
  gap: 12px;
  margin-top: 20px;
}
.metric-grid article,
.chart-grid article {
  background: #142b42;
  border: 1px solid #2b4660;
  border-radius: 9px;
  padding: 16px;
  min-width: 0;
}
.metric-grid span {
  font-size: 12px;
  color: #aac6df;
}
.metric-grid strong {
  display: block;
  font-size: 27px;
  color: #7ec8ff;
  margin-top: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.metric-grid small {
  font-size: 12px;
  margin-left: 6px;
}
.metric-grid p {
  font-size: 11px;
  color: #85a1bb;
}
.chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 20px;
}
.chart-grid h2 {
  font-size: 15px;
  margin: 0 0 18px;
  color: #d7eaff;
}
.chart-wide {
  grid-column: 1/-1;
}
.chart-note {
  margin: 8px 0 0;
}
@media (max-width: 850px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
  .statistics-screen {
    padding: 16px;
  }
  .filters label {
    flex: 1;
    min-width: 130px;
  }
}
</style>
