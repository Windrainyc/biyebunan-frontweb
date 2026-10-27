<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { request, errorText } from '../api/client';
const orderNo = ref(''),
  phone = ref(''),
  code = ref(''),
  challenge = ref(''),
  error = ref(''),
  success = ref(false),
  busy = ref(false),
  remaining = ref(0);
let previous = '',
  key = '';
const timer = setInterval(() => {
  if (remaining.value) remaining.value--;
}, 1000);
onBeforeUnmount(() => clearInterval(timer));
async function send() {
  busy.value = true;
  error.value = '';
  try {
    const data = await request<{ challengeId: string; retryAfterSeconds: number }>(
      '/auth/challenges',
      {
        method: 'POST',
        body: {
          phone: phone.value,
          purpose: 'BIND_ORDER',
          platform: 'student',
          orderNo: orderNo.value,
        },
      },
    );
    challenge.value = data.challengeId;
    remaining.value = data.retryAfterSeconds;
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function bind() {
  busy.value = true;
  error.value = '';
  try {
    const body = { orderNo: orderNo.value, challengeId: challenge.value, code: code.value };
    const fingerprint = JSON.stringify(body);
    if (fingerprint !== previous) {
      key = crypto.randomUUID();
      previous = fingerprint;
    }
    await request('/student/order-bindings', { method: 'POST', body, key });
    success.value = true;
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section>
    <h1>绑定软件订单</h1>
    <p class="muted">订单手机号必须与你注册的手机号一致，验证码仅用于本次订单归属验证。</p>
    <p v-if="success" class="success" role="status">
      订单绑定成功。<RouterLink to="/student/orders">查看我的订单</RouterLink>
    </p>
    <form v-else class="binding-form" @submit.prevent="bind">
      <label
        >订单编号<input v-model="orderNo" maxlength="200" required @input="challenge = ''" /></label
      ><label
        >注册手机号<input
          v-model="phone"
          type="tel"
          pattern="1[0-9]{10}"
          maxlength="11"
          required
          @input="challenge = ''" /></label
      ><button
        type="button"
        class="button"
        :disabled="busy || remaining > 0 || !orderNo || !/^1\d{10}$/.test(phone)"
        @click="send"
      >
        {{ remaining ? `${remaining}秒后重试` : '发送归属验证码' }}</button
      ><label
        >验证码<input v-model="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required
      /></label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="button primary" :disabled="busy || !challenge">
        {{ busy ? '处理中…' : '确认绑定' }}
      </button>
    </form>
  </section>
</template>
<style scoped>
.binding-form {
  display: grid;
  gap: 20px;
  max-width: 500px;
  margin-top: 28px;
  background: white;
  padding: 28px;
  border: 1px solid #e2e6ef;
  border-radius: 12px;
}
.binding-form label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
</style>
