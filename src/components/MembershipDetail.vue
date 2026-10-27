<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { display } from '../config/labels';
import type { Page, Row } from '../types/api';
import ReferenceField from './ReferenceField.vue';
const props = defineProps<{ record: Row; mode: 'plan' | 'user' }>(),
  emit = defineEmits<{ changed: [] }>();
const items = ref<Row[]>([]),
  page = ref(1),
  total = ref(0),
  duration = ref(30),
  tokens = ref(0),
  amount = ref('0'),
  date = ref(''),
  plan = ref(''),
  reason = ref(''),
  error = ref(''),
  busy = ref(false),
  notice = ref('');
const attempt = writeAttempt(),
  path = () =>
    props.mode === 'plan'
      ? `/admin/membership-plans/${props.record.id}/versions`
      : `/admin/users/${props.record.id}/memberships`;
const loading = ref(false);
let generation = 0;
async function load() {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const data = await request<Page<Row>>(path(), { query: { page: page.value, size: 20 } });
    if (current !== generation) return;
    items.value = data.items;
    total.value = data.total;
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) loading.value = false;
  }
}
async function submit() {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const time = new Date(date.value).toISOString();
    const body =
      props.mode === 'plan'
        ? {
            durationDays: duration.value,
            monthlyTokenQuota: tokens.value,
            monthlyAmountLimit: amount.value,
            effectiveFrom: time,
          }
        : { planId: plan.value, startsAt: time, reason: reason.value };
    const version = props.mode === 'plan' ? props.record.version : undefined;
    await request(path(), { method: 'POST', body, version, key: attempt({ body, version }) });
    notice.value = props.mode === 'plan' ? '权益版本已新增，历史版本保持不变' : '会员已授予';
    await load();
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function revoke(row: Row) {
  busy.value = true;
  try {
    const body = { reason: reason.value };
    await request(`/admin/memberships/${row.id}/revoke`, {
      method: 'POST',
      body,
      version: row.version,
      key: attempt({ id: row.id, ...body }),
    });
    await load();
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
watch(
  () => props.record.id,
  () => {
    page.value = 1;
    void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => generation++);
</script>
<template>
  <section>
    <h3>{{ mode === 'plan' ? '会员权益版本' : '会员记录' }}</h3>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <article v-for="item in items" :key="String(item.id)" class="membership">
      <template v-if="mode === 'plan'"
        ><strong>有效{{ item.durationDays }}天</strong>
        <p>每月{{ item.monthlyTokenQuota }}词元 · 金额上限{{ item.monthlyAmountLimit }}元</p>
        <span>生效：{{ display(item.effectiveFrom) }}</span></template
      ><template v-else
        ><strong>{{ display(item.state || item.status) }}</strong>
        <p>{{ display(item.startsAt) }} 至 {{ display(item.expiresAt) }}</p>
        <button
          class="button"
          :disabled="busy || !reason || item.state === 'REVOKED'"
          @click="revoke(item)"
        >
          撤销会员
        </button></template
      >
    </article>
    <p v-if="!items.length" class="muted">暂无记录</p>
    <div class="pagination">
      <button
        class="button"
        :disabled="loading || busy || page === 1"
        @click="
          page--;
          load();
        "
      >
        上一页</button
      ><span>第{{ page }}页 · 共{{ total }}条</span
      ><button
        class="button"
        :disabled="loading || busy || page * 20 >= total"
        @click="
          page++;
          load();
        "
      >
        下一页
      </button>
    </div>
    <form @submit.prevent="submit">
      <h3>{{ mode === 'plan' ? '新增权益版本' : '授予会员' }}</h3>
      <template v-if="mode === 'plan'"
        ><label
          >有效天数<input
            v-model.number="duration"
            type="number"
            min="1"
            max="36500"
            required /></label
        ><label
          >每月词元额度<input
            v-model.number="tokens"
            type="number"
            min="0"
            max="9007199254740991"
            required /></label
        ><label
          >每月金额上限（元）<input
            v-model="amount"
            pattern="[0-9]{1,14}(\.[0-9]{1,6})?"
            required /></label></template
      ><template v-else
        ><ReferenceField v-model="plan" field="planId" required /><label
          >授予或撤销原因<input v-model="reason" maxlength="200" required /></label></template
      ><label>生效时间<input v-model="date" type="datetime-local" required /></label
      ><button class="button primary" :disabled="busy">
        确认{{ mode === 'plan' ? '新增' : '授予' }}
      </button>
    </form>
  </section>
</template>
<style scoped>
.membership {
  padding: 16px;
  border: 1px solid #e2e6ef;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}
.membership span {
  color: #748096;
}
form {
  display: grid;
  gap: 14px;
}
label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
</style>
