<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { auth, request, errorText } from '../api/client';
import { operation } from '../config/contract';
import { recordActions } from '../config/record-actions';
import type { Resource } from '../config/resources';
import type { Row, Page } from '../types/api';
import CreatePage from './CreatePage.vue';
import ProjectDetail from './ProjectDetail.vue';
import OrderDetail from './OrderDetail.vue';
import KnowledgeDetail from './KnowledgeDetail.vue';
import RecordActions from './RecordActions.vue';
import StatusBadge from './StatusBadge.vue';
const props = defineProps<{ resource: Resource }>();
const emit = defineEmits<{ changed: [] }>();
const route = useRoute(),
  router = useRouter();
const record = ref<Row | null>(null),
  error = ref(''),
  loading = ref(false);
let generation = 0;
onBeforeUnmount(() => { generation++; });
const action = computed(
  () =>
    record.value &&
    recordActions(props.resource.key, record.value).find(
      (a) => a.path.split('/').pop() === route.query.operation,
    ),
);
function back() {
  const { process, operation: ignored, ...query } = route.query;
  void router.push({ path: route.path, query });
}
watch(
  () => [route.query.process, route.query.operation, props.resource.path],
  async () => {
    const current = ++generation;
    record.value = null;
    error.value = '';
    loading.value = true;
    try {
      const id = String(route.query.process || '');
      const detail = operation('GET', props.resource.path + '/{id}');
      let found: Row | undefined;
      if (detail && (!detail.permission || auth.permissions.includes(detail.permission))) {
        found = await request<Row>(props.resource.path + '/' + encodeURIComponent(id));
      } else {
        // 无详情接口的治理记录，逐页读取授权列表，刷新页面也不依赖旧快照。
        for (let page = 1; ; page++) {
          const result = await request<Page<Row>>(
            props.resource.path + '?page=' + page + '&size=100',
          );
          if (current !== generation) return;
          found = result.items.find((r) => r.id === id);
          if (found || page * 100 >= result.total || !result.items.length) break;
        }
      }
      if (current === generation) {
        if (!found) throw new Error('记录不存在或当前账号无权处理');
        record.value = found;
      }
    } catch (e) {
      if (current === generation) error.value = errorText(e);
    } finally {
      if (current === generation) loading.value = false;
    }
  },
  { immediate: true },
);
function changed() {
  emit('changed');
  back();
}
</script>
<template>
  <CreatePage
    :title="action?.title || '业务处理'"
    breadcrumb="业务处理"
    description="核对记录及当前状态后提交处理，完成后返回列表。"
    @back="back"
  >
    <p v-if="loading" role="status">正在读取最新记录…</p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
    <template v-else-if="record && action">
      <h2>{{ record.title || record.name || record.code || resource.title }}</h2>
      <p>
        当前状态：<StatusBadge
          :value="String(record.state || record.status || record.stage || '')"
        />
      </p>
      <KnowledgeDetail v-if="resource.key === 'contents'" :content="record" readonly />
      <ProjectDetail
        v-if="
          resource.key === 'projects' &&
          ['milestones', 'deliveries'].includes(String(route.query.operation))
        "
        :project="record"
        :section="route.query.operation === 'milestones' ? 'milestones' : 'deliveries'"
      />
      <OrderDetail
        v-else-if="
          resource.key === 'orders' &&
          ['receipt', 'assignment'].includes(String(route.query.operation))
        "
        :order="record"
        :mode="String(route.query.operation)"
        @changed="changed"
      />
      <RecordActions
        v-else
        :key="String(record.id) + action.path"
        :resource-key="resource.key"
        :record="record"
        :action-path="action.path"
        @changed="changed"
        @cancel="back"
      />
    </template>
    <p v-else role="alert">当前状态或权限不允许此操作，请返回列表查看最新状态。</p>
  </CreatePage>
</template>
