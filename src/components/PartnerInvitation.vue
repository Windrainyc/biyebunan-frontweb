<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { auth, errorText, request } from '../api/client';
import { writeAttempt } from '../api/attempt';
import { operation } from '../config/contract';
const emit = defineEmits<{ changed: [] }>();
const expanded = ref(false),
  phone = ref(''),
  name = ref(''),
  hours = ref(24),
  busy = ref(false),
  error = ref('');
const invitation = ref<{ activationUrl: string; expiresAt: string } | null>(null);
const attempt = writeAttempt();
let generation = 0;
const allowed = computed(() => {
  const op = operation('POST', '/admin/partner-invitations');
  return (
    auth.platform === 'admin' &&
    !!op &&
    (!op.permission || auth.permissions.includes(op.permission))
  );
});
function close() {
  generation++;
  expanded.value = false;
  invitation.value = null;
  error.value = '';
  busy.value = false;
}
async function submit() {
  if (!allowed.value) return;
  const current = ++generation;
  busy.value = true;
  error.value = '';
  invitation.value = null;
  const body = { phone: phone.value, displayName: name.value, expiresInHours: hours.value };
  try {
    const result = await request<{ activationUrl: string; expiresAt: string }>(
      '/admin/partner-invitations',
      { method: 'POST', body, key: attempt(body) },
    );
    if (current !== generation) return;
    invitation.value = result;
    emit('changed');
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) busy.value = false;
  }
}
onBeforeUnmount(() => generation++);
</script>
<template>
  <section v-if="allowed" class="invite-partner">
    <button v-if="!expanded" class="button" @click="expanded = true">邀请项目中介</button>
    <div v-else class="invite-card">
      <h2>邀请项目中介</h2>
      <p class="muted">
        创建待激活中介账户并生成一次性邀请，不会自动发送短信或邮件。请仅把链接交给对应账户本人。
      </p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <form @submit.prevent="submit">
        <label>中介姓名<input v-model="name" required maxlength="200" /></label>
        <label
          >中介手机号<input v-model="phone" required pattern="1[0-9]{10}" inputmode="tel"
        /></label>
        <label
          >邀请有效小时<input v-model.number="hours" required type="number" min="1" max="72"
        /></label>
        <button class="button primary" :disabled="busy">生成中介邀请</button>
      </form>
      <div v-if="invitation" class="notice">
        <p role="status">邀请已生成，账户需完成验证后才能登录。</p>
        <label>一次性邀请链接<textarea :value="invitation.activationUrl" readonly /></label>
        <p>有效至 {{ new Date(invitation.expiresAt).toLocaleString('zh-CN') }}</p>
      </div>
      <button class="button" @click="close">关闭并隐藏邀请</button>
    </div>
  </section>
</template>
<style scoped>
.invite-partner {
  margin: 0 0 20px;
}
.invite-card {
  padding: 24px;
  border: 1px solid #e2e6ef;
  border-radius: 12px;
  background: white;
}
h2 {
  margin-top: 0;
  font-size: 20px;
}
form {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 16px;
  margin: 20px 0;
}
label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
textarea {
  min-height: 90px;
  width: 100%;
}
</style>
