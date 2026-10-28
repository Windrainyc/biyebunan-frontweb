<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { auth, errorText, request } from '../api/client';
import { operation } from '../config/contract';
import { writeAttempt } from '../api/attempt';
import type { Row } from '../types/api';
const props = defineProps<{ user: Row }>();
const hours = ref(24),
  busy = ref(false),
  error = ref('');
const invitation = ref<{ activationUrl: string; expiresAt: string } | null>(null);
let attempt = writeAttempt();
let generation = 0;
watch(
  () => props.user.id,
  () => {
    generation++;
    invitation.value = null;
    error.value = '';
    busy.value = false;
    attempt = writeAttempt();
  },
);
onBeforeUnmount(() => generation++);
const allowed = computed(() => {
  const op = operation('POST', '/admin/users/{id}/invitations');
  return op && (!op.permission || auth.permissions.includes(op.permission));
});
async function issue() {
  const current = ++generation;
  busy.value = true;
  invitation.value = null;
  error.value = '';
  const body = { expiresInHours: hours.value };
  try {
    const result = await request<{ activationUrl: string; expiresAt: string }>(
      `/admin/users/${props.user.id}/invitations`,
      {
        method: 'POST',
        body,
        key: attempt({ userId: props.user.id, ...body }),
      },
    );
    if (current === generation) invitation.value = result;
  } catch (e) {
    if (current === generation) error.value = errorText(e);
  } finally {
    if (current === generation) busy.value = false;
  }
}
</script>
<template>
  <section v-if="allowed && user.platform !== 'student'">
    <h3>账户激活邀请</h3>
    <p class="muted">
      仅待激活账户可签发。重新签发会使旧邀请失效；链接包含一次性凭据，请仅交给对应账户本人。
    </p>
    <form @submit.prevent="issue">
      <label
        >有效期（小时）<input v-model.number="hours" type="number" min="1" max="72" required
      /></label>
      <button class="button" :disabled="busy">{{ busy ? '签发中…' : '签发激活邀请' }}</button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div v-if="invitation" class="notice">
      <label
        >激活链接<textarea :value="invitation.activationUrl" readonly aria-label="激活链接" />
      </label>
      <p>失效时间：{{ new Date(invitation.expiresAt).toLocaleString('zh-CN') }}</p>
      <button class="button" @click="invitation = null">隐藏链接</button>
    </div>
  </section>
</template>
