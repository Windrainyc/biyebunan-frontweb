<script setup lang="ts">
import { termsConfiguration } from '../config/terms';
import { writeAttempt } from '../api/attempt';
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { acceptSession, request, errorText } from '../api/client';
import type { Platform, Session } from '../types/api';
const route = useRoute(),
  router = useRouter(),
  platform = computed(() => route.params.platform as Platform),
  mode = computed(() => String(route.meta.entry));
const phone = ref(''),
  password = ref(''),
  name = ref(''),
  code = ref(''),
  challenge = ref(''),
  token = ref(
    String(new URLSearchParams(route.hash.slice(1)).get('token') || route.query.token || ''),
  ),
  mfa = ref(''),
  enrollment = ref(''),
  otp = ref(''),
  error = ref(''),
  busy = ref(false),
  sending = ref(false),
  remaining = ref(0),
  accepted = ref(false);
const terms = termsConfiguration(
  import.meta.env.VITE_TERMS_URL,
  import.meta.env.VITE_TERMS_VERSION,
);
const termsUrl = terms?.url,
  termsVersion = terms?.version;
const needsTerms = computed(
  () => mode.value === 'register' || (mode.value === 'activate' && platform.value === 'partner'),
);
const title = computed(() =>
  mode.value === 'reset'
    ? '重置密码'
    : mode.value === 'register'
      ? '注册学生账户'
      : platform.value === 'admin'
        ? '激活管理员账户'
        : '激活项目中介账户',
);
const attempt = writeAttempt();
// 邀请令牌只留内存，移出地址栏，避免复制页面地址时扩散。
if (route.query.token || route.hash) void router.replace({ path: route.path, query: {}, hash: '' });
const interval = setInterval(() => {
  if (remaining.value > 0) remaining.value--;
}, 1000);
onBeforeUnmount(() => clearInterval(interval));
async function send() {
  sending.value = true;
  error.value = '';
  try {
    const result = await request<{
      challengeId: string;
      retryAfterSeconds: number;
    }>('/auth/challenges', {
      method: 'POST',
      authenticated: false,
      body: {
        phone: phone.value,
        platform: platform.value,
        purpose:
          mode.value === 'reset'
            ? 'RESET_PASSWORD'
            : mode.value === 'register'
              ? 'REGISTER'
              : 'ACTIVATE',
      },
    });
    challenge.value = result.challengeId;
    remaining.value = result.retryAfterSeconds;
  } catch (e) {
    error.value = errorText(e);
  } finally {
    sending.value = false;
  }
}
async function enroll() {
  busy.value = true;
  error.value = '';
  try {
    const data = await request<{ enrollmentId: string; otpAuthUri: string }>(
      '/auth/admin/mfa-enrollments',
      {
        method: 'POST',
        authenticated: false,
        body: { invitationToken: token.value },
      },
    );
    enrollment.value = data.enrollmentId;
    otp.value = data.otpAuthUri;
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
async function submit() {
  busy.value = true;
  error.value = '';
  try {
    if (needsTerms.value && (!termsUrl || !termsVersion || !accepted.value))
      throw new Error('请先阅读并同意平台提供的服务协议');
    if (mode.value === 'reset') {
      await request('/auth/password-reset', {
        method: 'POST',
        authenticated: false,
        key: attempt({
          challengeId: challenge.value,
          code: code.value,
          newPassword: password.value,
        }),
        body: {
          challengeId: challenge.value,
          code: code.value,
          newPassword: password.value,
        },
      });
      await router.push(`/${platform.value}/login`);
      return;
    }
    const body =
      platform.value === 'admin'
        ? {
            invitationToken: token.value,
            password: password.value,
            mfaEnrollmentId: enrollment.value,
            mfaCode: mfa.value,
          }
        : {
            phone: phone.value,
            password: password.value,
            displayName: name.value,
            challengeId: challenge.value,
            code: code.value,
            termsVersion,
            ...(platform.value === 'partner' ? { invitationToken: token.value } : {}),
          };
    const session = await request<Session>(
      `/auth/${platform.value}/${mode.value === 'register' ? 'register' : 'activate'}`,
      { method: 'POST', authenticated: false, key: attempt(body), body },
    );
    await acceptSession(session, platform.value);
    await router.push(`/${platform.value}`);
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="entry-page">
    <form class="entry-form" @submit.prevent="submit">
      <RouterLink :to="`/${platform}/login`">← 返回登录</RouterLink>
      <h1>{{ title }}</h1>
      <p v-if="needsTerms && !termsUrl" class="notice">
        平台尚未配置有效的服务协议地址和版本，暂不能完成注册激活。
      </p>
      <label v-if="mode === 'activate'"
        >邀请凭据<input v-model="token" type="password" required autocomplete="off" /></label
      ><template v-if="platform === 'admin' && mode === 'activate'"
        ><button type="button" class="button" :disabled="busy || !token" @click="enroll">
          配置身份认证器</button
        ><template v-if="otp"
          ><p class="notice">请使用个人认证器导入下方配置。此配置包含账户认证秘密，请勿分享。</p>
          <a :href="otp" class="button">在认证器中打开</a>
          <details>
            <summary>手动导入配置</summary>
            <code>{{ otp }}</code>
          </details></template
        ><label
          >动态验证码<input
            v-model="mfa"
            inputmode="numeric"
            pattern="[0-9]{6}"
            maxlength="6"
            required
            autocomplete="one-time-code" /></label></template
      ><template v-else
        ><label
          >手机号<input
            v-model="phone"
            type="tel"
            pattern="1[0-9]{10}"
            maxlength="11"
            required
            autocomplete="username" /></label
        ><label v-if="mode !== 'reset'"
          >姓名<input v-model="name" maxlength="200" required autocomplete="name"
        /></label>
        <div class="code-row">
          <label
            >短信验证码<input
              v-model="code"
              inputmode="numeric"
              pattern="[0-9]{6}"
              maxlength="6"
              required
              autocomplete="one-time-code" /></label
          ><button
            type="button"
            class="button"
            :disabled="sending || remaining > 0 || !/^1\d{10}$/.test(phone)"
            @click="send"
          >
            {{ remaining ? `${remaining}秒后重试` : sending ? '发送中…' : '获取验证码' }}
          </button>
        </div></template
      ><label
        >设置密码<input
          v-model="password"
          type="password"
          minlength="10"
          maxlength="128"
          required
          autocomplete="new-password"
        /><small class="muted">至少10个字符，建议组合大小写字母、数字与符号。</small></label
      ><label v-if="needsTerms && termsUrl" class="consent"
        ><input v-model="accepted" type="checkbox" required />我已阅读并同意<a
          :href="termsUrl"
          target="_blank"
          rel="noopener noreferrer"
          >服务协议</a
        ></label
      >
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button
        class="button primary"
        :disabled="busy || (needsTerms && (!termsUrl || !termsVersion))"
      >
        {{ busy ? '处理中…' : title }}
      </button>
    </form>
  </main>
</template>
<style scoped>
.entry-page {
  min-height: 100vh;
  padding: 48px 20px;
  background: #f4f5f8;
}
.entry-form {
  max-width: 540px;
  margin: auto;
  padding: 36px;
  border: 1px solid #e2e6ef;
  background: white;
  border-radius: 16px;
  display: grid;
  gap: 20px;
}
.entry-form label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
.entry-form a {
  color: #2c4bdb;
}
.entry-form h1 {
  margin: 0;
  font-size: 26px;
}
.code-row {
  display: flex;
  gap: 12px;
  align-items: end;
}
.code-row label {
  flex: 1;
  min-width: 0;
}
.entry-form .consent {
  display: flex;
  align-items: center;
  gap: 8px;
}
.entry-form code {
  font-size: 11px;
  word-break: break-all;
}
</style>
