<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ApiError, auth, request, errorText } from '../api/client';
import { display } from '../config/labels';
import { writeAttempt } from '../api/attempt';
import type { Row, User } from '../types/api';
import ReferenceField from '../components/ReferenceField.vue';
const profile = ref<Row | null>(null),
  name = ref(''),
  school = ref(''),
  major = ref(''),
  error = ref(''),
  notice = ref(''),
  busy = ref(false),
  quota = ref<Row | null>(null),
  membership = ref<Row | null>(null),
  membershipError = ref(''),
  membershipLoaded = ref(false);
const attempt = writeAttempt();
onMounted(async () => {
  try {
    profile.value = await request<Row>(`/${auth.platform}/me`);
    name.value = String(profile.value.displayName || '');
    school.value = String(profile.value.schoolId || '');
    major.value = String(profile.value.majorId || '');
    if (auth.platform === 'student') {
      await Promise.all([
        request<Row>('/student/quota').then((value) => {
          quota.value = value;
        }),
        request<Row>('/student/membership')
          .then((value) => {
            membership.value = value;
          })
          .catch((e) => {
            if (!(e instanceof ApiError && e.status === 404)) membershipError.value = errorText(e);
          })
          .finally(() => {
            membershipLoaded.value = true;
          }),
      ]);
    }
  } catch (e) {
    error.value = errorText(e);
  }
});
async function save() {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    const body = { displayName: name.value, schoolId: school.value, majorId: major.value };
    const updated = await request<User>(`/${auth.platform}/me`, {
      method: 'PUT',
      body,
      version: profile.value?.version,
      key: attempt(body),
    });
    profile.value = updated as unknown as Row;
    auth.user = updated;
    notice.value = '资料已更新';
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section>
    <h1>我的账户</h1>
    <p class="muted">更新个人资料，查看当前可用额度。</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <article v-if="auth.platform === 'student'" class="membership-card">
      <h2>当前会员</h2>
      <p v-if="membershipError" class="error" role="alert">{{ membershipError }}</p>
      <template v-else-if="membership"
        ><strong>{{ display(membership.state) }}</strong>
        <p>{{ display(membership.startsAt) }} 至 {{ display(membership.expiresAt) }}</p>
        <p class="muted">会员有效期与当前额度分别管理，实际可用量以下方账户数据为准。</p>
      </template>
      <p v-else-if="membershipLoaded" class="muted">当前没有有效会员</p>
      <p v-else class="muted">正在读取会员状态…</p>
    </article>
    <div v-if="quota" class="quota">
      <article>
        <span>可用词元</span><strong>{{ quota.availableTokens }}</strong>
      </article>
      <article>
        <span>预占词元</span><strong>{{ quota.reservedTokens }}</strong>
      </article>
      <article>
        <span>可用金额</span><strong>{{ quota.availableAmount }}元</strong>
      </article>
      <article>
        <span>预占金额</span><strong>{{ quota.reservedAmount }}元</strong>
      </article>
    </div>
    <form v-if="profile" class="profile" @submit.prevent="save">
      <label>姓名<input v-model="name" maxlength="200" required /></label
      ><label>手机号<input :value="String(profile.phoneMasked)" readonly /></label>
      <div>
        <p>院校</p>
        <ReferenceField
          v-model="school"
          field="schoolId"
          required
          @update:model-value="major = ''"
        />
      </div>
      <div>
        <p>专业</p>
        <ReferenceField v-model="major" field="majorId" :filters="{ schoolId: school }" required />
      </div>
      <button class="button primary" :disabled="busy">保存资料</button>
    </form>
  </section>
</template>
<style scoped>
.membership-card {
  margin-top: 24px;
  padding: 24px;
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 12px;
}
.membership-card h2 {
  margin-top: 0;
  font-size: 20px;
}
.profile {
  max-width: 650px;
  display: grid;
  gap: 18px;
  background: white;
  padding: 24px;
  border: 1px solid #e2e6ef;
  border-radius: 12px;
  margin-top: 24px;
}
.profile label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
.profile p {
  font-size: 13px;
}
.quota {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 24px;
}
.quota article {
  background: white;
  border: 1px solid #e2e6ef;
  border-radius: 10px;
  padding: 20px;
}
.quota span {
  color: #748096;
  font-size: 12px;
}
.quota strong {
  display: block;
  margin-top: 14px;
  font-size: 22px;
  font-weight: 500;
}
@media (max-width: 800px) {
  .quota {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
