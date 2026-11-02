<script setup lang="ts">
import { computed, ref } from 'vue';
import { auth, request, errorText } from '../api/client';
import { operation } from '../config/contract';
import { writeAttempt } from '../api/attempt';
import type { Row } from '../types/api';
import AssetUpload from './AssetUpload.vue';
import ReferenceField from './ReferenceField.vue';
const props = defineProps<{ order: Row; mode?: string }>(),
  emit = defineEmits<{ changed: [] }>();
const reference = ref(''),
  receivedAt = ref(''),
  reason = ref(''),
  proof = ref<Row | null>(null),
  partner = ref<unknown>(props.order.partnerId || ''),
  unassigned = ref(!props.order.partnerId),
  error = ref(''),
  busy = ref(false),
  notice = ref('');
const attempt = writeAttempt();
function allowed(path: string) {
  const op = operation('POST', path);
  return op && (!op.permission || auth.permissions.includes(op.permission));
}
const canReceipt = computed(
  () =>
    props.mode !== 'readonly' &&
    props.mode !== 'assignment' &&
    auth.platform === 'admin' &&
    allowed('/admin/orders/{id}/receipt'),
);
const canAssign = computed(
  () =>
    props.mode !== 'readonly' &&
    props.mode !== 'receipt' &&
    auth.platform === 'admin' &&
    allowed('/admin/orders/{id}/assignment'),
);
async function receipt() {
  if (!proof.value) return;
  busy.value = true;
  try {
    const body = {
      reference: reference.value,
      receivedAt: new Date(receivedAt.value).toISOString(),
      amount: String(props.order.amount),
      proofAssetId: proof.value.id,
      reason: reason.value,
    };
    await request(`/admin/orders/${props.order.id}/receipt`, {
      method: 'POST',
      body,
      version: props.order.version,
      key: attempt(body),
    });
    notice.value = '收款凭证已核验';
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function assign() {
  busy.value = true;
  try {
    const body = { partnerId: unassigned.value ? null : partner.value, reason: reason.value };
    await request(`/admin/orders/${props.order.id}/assignment`, {
      method: 'POST',
      body,
      version: props.order.version,
      key: attempt(body),
    });
    notice.value = '订单归属已更新';
    emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section>
    <p v-if="order.cancellationFinancialReviewRequired" class="notice">
      订单已取消且存在已确认收款，需要核对实际资金处理结果。取消订单不会自动退款。
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <label v-if="canReceipt || canAssign">操作原因<input v-model="reason" maxlength="200" /></label
    ><template v-if="canReceipt && order.receiptStatus === 'UNCONFIRMED'"
      ><h3>核验收款凭证</h3>
      <p class="muted">仅核验已确认订单的全额收款，历史核验记录不能覆盖。</p>
      <AssetUpload owner-type="RECEIPT" :owner-id="String(order.id)" @ready="proof = $event" />
      <form v-if="proof" @submit.prevent="receipt">
        <label>收款流水号<input v-model="reference" maxlength="200" required /></label
        ><label>收款时间<input v-model="receivedAt" type="datetime-local" required /></label>
        <p>核验金额：{{ order.amount }}元</p>
        <button class="button primary" :disabled="busy || !reason">确认核验</button>
      </form></template
    >
    <form v-if="canAssign" @submit.prevent="assign">
      <h3>项目中介归属</h3>
      <label class="checkbox"><input v-model="unassigned" type="checkbox" />不分配项目中介</label
      ><ReferenceField v-if="!unassigned" v-model="partner" field="partnerId" required /><button
        class="button primary"
        :disabled="busy || !reason || (!unassigned && !partner)"
      >
        更新归属
      </button>
    </form>
  </section>
</template>
<style scoped>
form {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}
label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
.checkbox {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
