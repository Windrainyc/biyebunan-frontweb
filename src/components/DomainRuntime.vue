<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from 'vue';
import { request, errorText } from '../api/client';
import { loginUrl } from '../config/domain-access';
import { display } from '../config/labels';
const data = ref<{
  endpoints: { platform: string; origin: string; probeAllowed: boolean }[];
  probesEnabled: boolean;
}>();
const error = ref('');
const busy = ref(false);
const controller = new AbortController();
async function load() {
  busy.value = true;
  error.value = '';
  try {
    data.value = await request('/admin/domains/runtime', { signal: controller.signal });
  } catch (e) {
    if (!controller.signal.aborted) error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => controller.abort());
</script>
<template>
  <section class="domain-runtime" aria-label="当前域名运行配置">
    <div class="runtime-heading">
      <strong>当前登录入口</strong
      ><button class="text-button" :disabled="busy" @click="load">
        {{ busy ? '读取中…' : '刷新状态' }}
      </button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <dl v-if="data">
      <div v-for="item in data.endpoints" :key="item.platform">
        <dt>{{ display(item.platform) }}</dt>
        <dd>
          <a
            v-if="loginUrl(item.origin, item.platform)"
            :href="loginUrl(item.origin, item.platform)"
            target="_blank"
            rel="noopener noreferrer"
            >{{ item.origin }}</a
          ><span v-else>入口配置无效</span
          ><small>{{ item.probeAllowed ? '允许连接检查' : '连接检查未开放' }}</small>
        </dd>
      </div>
    </dl>
    <p class="muted">
      这里显示服务器正在使用的登录地址。下方记录的保存、启用或停用不会自动更改解析、证书和登录入口；连接检查结果请在任务详情中查看。
    </p>
  </section>
</template>
<style scoped>
.domain-runtime {
  padding: 16px 20px;
  margin-bottom: 18px;
  border: 1px solid var(--line, #e5e8ef);
  border-radius: 12px;
  background: white;
}
.runtime-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin: 16px 0;
}
dt {
  font-size: 12px;
  color: #64748b;
}
dd {
  margin: 6px 0 0;
  overflow-wrap: anywhere;
  font-size: 13px;
}
small {
  display: block;
  color: #64748b;
  margin-top: 6px;
}
p {
  font-size: 12px;
  margin: 12px 0 0;
}
@media (max-width: 700px) {
  dl {
    grid-template-columns: 1fr;
  }
}
</style>
