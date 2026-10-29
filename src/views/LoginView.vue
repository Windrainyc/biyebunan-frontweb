<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login, errorText } from '../api/client';
import type { Platform } from '../types/api';
const route = useRoute(),
  router = useRouter();
const platform = computed(() => route.params.platform as Platform);
const phone = ref(''),
  password = ref(''),
  mfa = ref(''),
  busy = ref(false),
  error = ref('');
async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await login(platform.value, phone.value, password.value, mfa.value || undefined);
    await router.push(`/${platform.value}`);
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main
    class="login-page"
    :class="{ 'student-login': platform === 'student', 'management-login': platform !== 'student' }"
  >
    <section class="login-intro">
      <span class="brand-mark">知</span>
      <h1 v-if="platform === 'student'">从第一个问题，<br />到最后一次交付。</h1>
      <h1 v-else-if="platform === 'admin'">有序运营，<br />让每次交付值得信赖。</h1>
      <h1 v-else>每个项目，<br />都有清晰的下一步。</h1>
      <p>让项目有进度，让问题有答案。</p>
      <p>
        {{
          platform === 'admin'
            ? '维护平台数据，管理服务与交付。'
            : platform === 'partner'
              ? '连接学生与项目，清晰跟进每一次交付。'
              : '项目资料、知识检索与在线答疑，在这里汇集。'
        }}
      </p>
    </section>
    <form class="login-card" @submit.prevent="submit">
      <h2>
        {{
          platform === 'admin'
            ? '登录管理后台'
            : platform === 'partner'
              ? '登录中介协作平台'
              : '欢迎登录'
        }}
      </h2>
      <p class="muted">请使用所属平台的账户登录</p>
      <label
        >手机号<input
          v-model="phone"
          type="tel"
          autocomplete="username"
          required
          pattern="1[0-9]{10}"
          maxlength="11"
          placeholder="请输入手机号" /></label
      ><label
        >密码<input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          minlength="10"
          placeholder="请输入密码" /></label
      ><label v-if="platform === 'admin'"
        >动态验证码<input
          v-model="mfa"
          inputmode="numeric"
          autocomplete="one-time-code"
          required
          pattern="[0-9]{6}"
          maxlength="6"
          placeholder="认证器中的六位验证码"
      /></label>
      <p v-if="platform === 'admin'" class="muted login-mfa-help">
        使用已绑定认证器生成的动态验证码（TOTP），并非短信验证码。未绑定认证器时，请向平台管理员领取账户的绑定资料。
      </p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="button primary" :disabled="busy">
        {{ busy ? '正在登录…' : '登录平台' }}
      </button>
      <p class="muted">
        {{
          platform === 'admin'
            ? '管理员账户由平台受控分配。'
            : platform === 'partner'
              ? '中介账户通过邀请激活。'
              : '使用注册时的手机号与密码。'
        }}
      </p>
      <div class="entry-links">
        <RouterLink :to="`/${platform}/reset`">忘记密码</RouterLink
        ><RouterLink v-if="platform === 'student'" to="/student/register">注册学生账户</RouterLink
        ><RouterLink v-else :to="`/${platform}/activate`">邀请激活</RouterLink>
      </div>
    </form>
  </main>
</template>
<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #f4f5f8;
}
.login-intro {
  background: #132143;
  color: white;
  padding: 15vh 12%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.login-intro h1 {
  font-size: 38px;
}
.login-intro p {
  line-height: 2;
  color: #c6d0e6;
}
.brand-mark {
  background: #2c4bdb;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  font-size: 28px;
  border-radius: 16px;
}
.login-card {
  align-self: center;
  justify-self: center;
  width: min(420px, 85%);
  display: grid;
  gap: 22px;
  padding: 40px;
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 20px;
}
.login-card label {
  display: grid;
  gap: 9px;
}
.login-card h2,
.login-card p {
  margin: 0;
}
@media (max-width: 720px) {
  .login-page {
    grid-template-columns: 1fr;
  }
  .login-intro {
    padding: 32px;
  }
  .login-intro h1 {
    font-size: 26px;
  }
  .login-card {
    margin: 32px 0;
  }
}
.entry-links {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #2c4bdb;
}
</style>
