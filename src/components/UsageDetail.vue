<script setup lang="ts">
import { computed, ref } from 'vue';
import { auth, request, errorText } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { operation } from '../config/contract';
import type { Row } from '../types/api';
const props = defineProps<{ usage: Row }>(),
  emit = defineEmits<{ changed: [] }>();
const mode = ref('reconcile'),
  direction = ref('CREDIT'),
  amount = ref(''),
  reason = ref(''),
  evidence = ref(''),
  sha = ref(''),
  kind = ref('USAGE'),
  input = ref(0),
  output = ref(0),
  cached = ref(0),
  error = ref(''),
  notice = ref(''),
  busy = ref(false);
const attempt = writeAttempt(),
  runId = computed(() => String(props.usage.runId || props.usage.id));
const paths: Record<string, string> = {
  reconcile: '/admin/runs/{id}/reconcile',
  adjust: '/admin/usage-adjustments',
  adjudicate: '/admin/runs/{id}/adjudications',
};
const modes = computed(() =>
  Object.keys(paths).filter((key) => {
    const op = operation('POST', paths[key]);
    return op && (!op.permission || auth.permissions.includes(op.permission));
  }),
);
async function submit() {
  busy.value = true;
  error.value = '';
  try {
    const body =
      mode.value === 'reconcile'
        ? { reason: reason.value }
        : mode.value === 'adjust'
          ? {
              runId: runId.value,
              direction: direction.value,
              amount: amount.value,
              reason: reason.value,
              evidenceRef: evidence.value,
            }
          : {
              kind: kind.value,
              ...(kind.value === 'USAGE'
                ? {
                    inputTokens: input.value,
                    outputTokens: output.value,
                    cachedTokens: cached.value,
                  }
                : {}),
              reason: reason.value,
              evidenceRef: evidence.value,
              evidenceSha256: sha.value,
            };
    const result = await request<Row>(paths[mode.value]!.replace('{id}', runId.value), {
      method: 'POST',
      body,
      key: attempt({ mode: mode.value, ...body }),
    });
    notice.value =
      mode.value === 'reconcile'
        ? '核对任务已提交，请在异步任务中查看结果'
        : mode.value === 'adjudicate'
          ? '裁决声明已提交，必须由另一名管理员独立复核后生效'
          : '金额调整已记录，不会覆盖原始用量';
    if (result.id) emit('changed');
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section v-if="auth.platform === 'admin' && modes.length">
    <h3>用量核对与调整</h3>
    <p class="notice">
      没有可信用量证据时保留冻结状态。人工声明需由两名管理员独立核验，不能把填写凭据等同于供应商自动确认。
    </p>
    <form @submit.prevent="submit">
      <label
        >处理方式<select v-model="mode">
          <option v-if="modes.includes('reconcile')" value="reconcile">核对原调用凭据</option>
          <option v-if="modes.includes('adjust')" value="adjust">追加金额调整</option>
          <option v-if="modes.includes('adjudicate')" value="adjudicate">提交人工证据裁决</option>
        </select></label
      ><template v-if="mode === 'adjust'"
        ><label
          >调整方向<select v-model="direction">
            <option value="CREDIT">退还金额</option>
            <option value="DEBIT">追加扣减</option>
          </select></label
        ><label
          >金额（元）<input
            v-model="amount"
            pattern="[0-9]{1,14}(\.[0-9]{1,6})?"
            required /></label></template
      ><template v-if="mode === 'adjudicate'"
        ><label
          >凭据结论<select v-model="kind">
            <option value="USAGE">已确认实际用量</option>
            <option value="NO_CHARGE">已确认未计费</option>
          </select></label
        >
        <div v-if="kind === 'USAGE'" class="token-fields">
          <label
            >输入词元<input
              v-model.number="input"
              type="number"
              min="0"
              max="1000000000"
              required /></label
          ><label
            >输出词元<input
              v-model.number="output"
              type="number"
              min="0"
              max="1000000000"
              required /></label
          ><label
            >缓存词元<input v-model.number="cached" type="number" min="0" :max="input" required
          /></label>
        </div>
        <label
          >凭据文件校验摘要<input
            v-model="sha"
            pattern="[0-9a-f]{64}"
            required
            maxlength="64" /></label></template
      ><label v-if="mode !== 'reconcile'"
        >凭据编号或受控存档地址<input v-model="evidence" maxlength="1000" required /></label
      ><label>处理原因<textarea v-model="reason" maxlength="1000" rows="3" required /></label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="notice" class="success" role="status">{{ notice }}</p>
      <button class="button primary" :disabled="busy">提交处理</button>
    </form>
  </section>
</template>
<style scoped>
form {
  display: grid;
  gap: 16px;
}
label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
.token-fields {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
</style>
