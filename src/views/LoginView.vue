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
  showPassword = ref(false),
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
      <h1 v-if="platform === 'student'">每一点好奇，<br />都值得向前一步。</h1>
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
      <div v-if="platform === 'student'" class="student-mascots">
        <span
          v-for="n in [5, 7, 0]"
          :key="n"
          :style="{ backgroundPosition: `${(n % 5) * 25}% ${n > 4 ? 100 : 0}%` }"
        />
      </div>
    </section>
    <form class="login-card" @submit.prevent="submit">
      <h2>
        {{
          platform === 'admin'
            ? '登录管理后台'
            : platform === 'partner'
              ? '登录中介协作平台'
              : '开启今天的进步'
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
        >密码<span class="password-field"
          ><input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
            minlength="10"
            placeholder="请输入密码"
          /><button
            type="button"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            {{ showPassword ? '隐藏' : '显示' }}
          </button></span
        ></label
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
.password-field {
  position: relative;
  display: flex;
  min-width: 0;
}
.password-field input {
  width: 100%;
  min-width: 0;
  padding-right: 64px;
}
.password-field button {
  position: absolute;
  right: 8px;
  top: 0;
  bottom: 0;
  background: transparent;
  border: 0;
  color: #3659b8;
  cursor: pointer;
  padding: 0 8px;
}
.password-field button:focus-visible {
  outline: 2px solid #3659b8;
  outline-offset: -2px;
}
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
.student-login {
  background: white;
}
.student-login .login-intro {
  background: #edf2ff;
  color: #19243b;
  padding: 8vh 10%;
}
.student-login .login-intro h1 {
  font:
    700 clamp(32px, 3.5vw, 56px) / 1.25 -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  letter-spacing: -1px;
}
.student-login .login-intro p {
  color: #697c9c;
}
.student-login .login-card {
  border: 0;
  border-radius: 0;
  padding: 25px;
  width: min(400px, 90%);
}
.student-login .login-card h2 {
  font-family: inherit;
  font-size: 28px;
}
.student-mascots {
  display: flex;
  gap: 12px;
  margin-top: 40px;
}
.student-mascots span {
  display: block;
  width: 100px;
  height: 100px;
  border: 4px solid white;
  border-radius: 50%;
  background-image: url('/avatars/students.png');
  background-size: 500% 200%;
}
.student-mascots span:nth-child(2) {
  transform: translateY(20px);
}
@media (max-width: 720px) {
  .student-login .login-intro {
    padding: 28px;
  }
  .student-mascots {
    margin-top: 18px;
  }
  .student-mascots span {
    width: 65px;
    height: 65px;
  }
  .student-mascots span:nth-child(2) {
    transform: none;
  }
}
</style>
