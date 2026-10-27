<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { auth, request, errorText } from '../api/client';
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
async function load() {
  busy.value = true;
  error.value = '';
  try {
    data.value = await request<Statistics>(`/${auth.platform}/statistics`, {
      query: { from: from.value, to: to.value },
    });
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section>
    <h1>数据统计</h1>
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
    <p v-if="data" class="muted">
      生成时间：{{ display(data.generatedAt) }} · 数据延迟{{ data.lagSeconds }}秒
    </p>
    <div class="metric-grid">
      <article v-for="item in data?.items" :key="item.metric + item.bucket">
        <span>{{ names[item.metric] || '业务指标' }}</span
        ><strong
          >{{ item.value }}<small>{{ unit(item) }}</small></strong
        >
        <p>{{ item.bucket }}</p>
      </article>
    </div>
    <p v-if="data && !data.items.length" class="empty">所选期间暂无统计数据</p>
  </section>
</template>
<style scoped>
.filters {
  display: flex;
  gap: 16px;
  align-items: end;
  margin: 24px 0;
}
.filters label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-top: 24px;
}
.metric-grid article {
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 12px;
  padding: 24px;
}
.metric-grid span {
  font-size: 13px;
  color: #748096;
}
.metric-grid strong {
  display: block;
  font-size: 28px;
  margin-top: 16px;
  font-weight: 500;
}
.metric-grid small {
  font-size: 12px;
  margin-left: 6px;
}
.metric-grid p {
  font-size: 12px;
  color: #748096;
}
</style>
