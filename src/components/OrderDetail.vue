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
  emit = defineEmits<{ changed: []; busy: [value: boolean]; cancel: [] }>();
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
    notice.value = '收款已核验';
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
  <section class="order-operation">
    <p v-if="order.cancellationFinancialReviewRequired" class="notice">
      订单已取消且存在已确认收款，需要核对实际资金处理结果。取消订单不会自动退款。
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <form v-if="canReceipt && order.receiptStatus === 'UNCONFIRMED'" @submit.prevent="receipt">
      <div class="receipt-fields">
        <label
          >支付渠道 <small>选填</small
          ><AppSelect v-model="channel"
            ><option value="">请选择支付渠道</option>
            <option value="WECHAT">微信</option>
            <option value="ALIPAY">支付宝</option>
            <option value="BANK_CARD">银行卡</option></AppSelect
          ></label
        >
        <label
          >支付金额（元）<small>选填</small
          ><input
            v-model="amount"
            inputmode="decimal"
            pattern="[0-9]{1,14}(\.[0-9]{1,6})?"
            placeholder="0.00"
        /></label>
        <label class="wide"
          >支付订单号 <small>选填</small
          ><input v-model="reference" maxlength="200" placeholder="输入支付流水或订单号"
        /></label>
        <label class="wide"
          >收款时间 <small>选填</small><input v-model="receivedAt" type="datetime-local"
        /></label>
        <div class="wide">
          <label>收款凭证 <small>选填</small></label
          ><AssetUpload
            compact
            owner-type="RECEIPT"
            :owner-id="String(order.id)"
            @ready="proof = $event"
          />
        </div>
        <label class="wide"
          >备注 <small>选填</small
          ><textarea v-model="reason" maxlength="200" placeholder="补充收款说明" />
        </label>
      </div>
      <p class="muted">请核对实际到账情况后确认。</p>
      <div class="operation-footer">
        <button type="button" class="button" :disabled="busy" @click="emit('cancel')">取消</button
        ><button class="button primary" :disabled="busy">确认已收款</button>
      </div>
    </form>
    <form v-if="canAssign" @submit.prevent="assign">
      <div>
        <label>负责中介</label
        ><ReferenceField
          v-model="partner"
          @update:model-value="unassigned = false"
          field="partnerId"
          dropdown
          :required="!unassigned"
        /><label class="checkbox"><input v-model="unassigned" type="checkbox" />不分配中介</label>
      </div>
      <label
        >备注 <small>选填</small
        ><textarea v-model="reason" maxlength="200" placeholder="补充本次分配说明" />
      </label>
      <div class="operation-footer">
        <button type="button" class="button" :disabled="busy" @click="emit('cancel')">取消</button
        ><button class="button primary" :disabled="busy || (!unassigned && !partner)">
          确认分配
        </button>
      </div>
    </form>
  </section>
</template>
<style scoped>
form {
  display: grid;
  gap: 18px;
  margin: 0;
}
.receipt-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.wide {
  grid-column: 1/-1;
}
label {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 13px;
  align-items: center;
}
label > input:not([type='checkbox']),
label > textarea,
label > :deep(.app-select) {
  flex-basis: 100%;
  margin-top: 3px;
}
small {
  font-size: 11px;
  color: #9aa2af;
  font-weight: 400;
}
.checkbox {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  font-size: 12px;
}
.muted {
  margin: 0;
  font-size: 12px;
}
.receipt-fields > div > label {
  margin-bottom: 7px;
}
</style>
