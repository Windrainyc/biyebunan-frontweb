<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { auth, request, errorText } from '../api/client';
import { operation } from '../config/contract';
import { writeAttempt } from '../api/attempt';
import type { Row } from '../types/api';
import AppSelect from './AppSelect.vue';
import AssetUpload from './AssetUpload.vue';
import ReferenceField from './ReferenceField.vue';
const props = defineProps<{ order: Row; mode?: string }>(),
  emit = defineEmits<{ changed: []; busy: [value: boolean] }>();
const reference = ref(''),
  receivedAt = ref(''),
  reason = ref(''),
  proof = ref<Row | null>(null),
  partner = ref<unknown>(props.order.partnerId || ''),
  unassigned = ref(!props.order.partnerId),
  error = ref(''),
  busy = ref(false),
  notice = ref('');
const amount = ref(''),
  channel = ref('');
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
  busy.value = true;
  try {
    const body = {
      reference: reference.value || undefined,
      receivedAt: receivedAt.value ? new Date(receivedAt.value).toISOString() : undefined,
      amount: amount.value || undefined,
      channel: channel.value || undefined,
      proofAssetId: proof.value?.id,
      reason: reason.value || undefined,
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
watch(busy, (value) => emit('busy', value));
</script>
<template>
  <section>
    <p v-if="order.cancellationFinancialReviewRequired" class="notice">
      订单已取消且存在已确认收款，需要核对实际资金处理结果。取消订单不会自动退款。
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <label v-if="canReceipt || canAssign"
      >备注（选填）<input v-model="reason" maxlength="200" /></label
    ><template v-if="canReceipt && order.receiptStatus === 'UNCONFIRMED'"
      ><h3>核验收款凭证</h3>
      <p class="muted">请核对实际到账情况。以下收款信息均为选填，历史核验记录保留。</p>
      <AssetUpload owner-type="RECEIPT" :owner-id="String(order.id)" @ready="proof = $event" />
      <form @submit.prevent="receipt">
        <label>支付订单号（选填）<input v-model="reference" maxlength="200" /></label
        ><label>收款时间<input v-model="receivedAt" type="datetime-local" /></label>
        <label
          >支付渠道（选填）<AppSelect v-model="channel"
            ><option value="">未填写</option>
            <option value="WECHAT">微信</option>
            <option value="ALIPAY">支付宝</option>
            <option value="BANK_CARD">银行卡</option></AppSelect
          ></label
        >
        <label
          >支付金额（选填，元）<input
            v-model="amount"
            inputmode="decimal"
            pattern="[0-9]{1,14}(\.[0-9]{1,6})?"
            placeholder="填写实际到账金额"
        /></label>
        <button class="button primary" :disabled="busy">确认核验</button>
      </form></template
    >
    <form v-if="canAssign" @submit.prevent="assign">
      <h3>项目中介归属</h3>
      <label class="checkbox"><input v-model="unassigned" type="checkbox" />不分配项目中介</label
      ><ReferenceField
        v-if="!unassigned"
        v-model="partner"
        field="partnerId"
        dropdown
        required
      /><button class="button primary" :disabled="busy || (!unassigned && !partner)">
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
