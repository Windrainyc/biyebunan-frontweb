<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { auth, request, errorText } from '../api/client';
import { operation } from '../config/contract';
import { recordActions } from '../config/record-actions';
import type { Resource } from '../config/resources';
import type { Row, Page } from '../types/api';
import CreatePage from './CreatePage.vue';
import CompactDialog from './CompactDialog.vue';
import ProjectDetail from './ProjectDetail.vue';
import OrderDetail from './OrderDetail.vue';
import KnowledgeDetail from './KnowledgeDetail.vue';
import RecordActions from './RecordActions.vue';
import StatusBadge from './StatusBadge.vue';
const props = defineProps<{ resource: Resource }>();
const emit = defineEmits<{ changed: [] }>();
const descriptions: Record<string, string> = {
  'submit-review': '提交后进入待审核状态，审核发布前学生无法看到本次内容。',
  publish: '发布后，符合可见范围的用户可以阅读本次内容。请核对正文、附件和可见范围。',
  withdraw: '撤回后内容不再公开展示，已保存的记录仍会保留。',
  reindex: '重新处理当前内容的检索索引；处理结果以索引状态为准。',
  transition: '请核对订单当前状态，提交后以服务端校验结果为准。',
  receipt: '核对实际收款信息后再确认，避免把未收到的款项标记为已收款。',
  assignment: '选择负责此订单的中介，并核对关联学生与服务资料。',
  milestones: '管理项目计划节点、截止日期与完成情况。',
  deliveries: '上传本次变更的交付文件，统一发布为一个版本；未修改的类别保留当前文件。',
  acceptance: '核对本次交付及验收结论后提交，验收对象以当前记录为准。',
  stage: '核对当前进度后推进项目阶段，可按需补充备注。',
  moderation: '查看完整内容后选择处理结果，必要时填写原因。',
  decision: '核对相关证据后提交处理结论。',
};
const route = useRoute(),
  router = useRouter();
const operationBusy = ref(false);
const record = ref<Row | null>(null),
  error = ref(''),
  loading = ref(false);
let generation = 0;
onBeforeUnmount(() => {
  generation++;
});
const action = computed(
  () =>
    record.value &&
    recordActions(props.resource.key, record.value).find(
      (a) => a.path.split('/').pop() === route.query.operation,
    ),
);
function back() {
  if (operationBusy.value) return;
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
  operationBusy.value = false;
  emit('changed');
  back();
}
</script>
<template>
  <component
    :is="
      ['transition', 'receipt', 'assignment', 'stage'].includes(String(route.query.operation))
        ? CompactDialog
        : CreatePage
    "
    :busy="operationBusy"
    :title="action?.title || '业务处理'"
    breadcrumb="业务处理"
    :description="
      descriptions[String(route.query.operation)] || '核对当前记录后提交处理，完成后返回列表。'
    "
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
      <ol v-if="resource.key === 'contents'" class="workflow-progress" aria-label="知识发布流程">
        <li
          v-for="step in [
            { state: 'DRAFT', title: '编辑草稿' },
            { state: 'REVIEW', title: '提交审核' },
            { state: 'PUBLISHED', title: '发布可见' },
          ]"
          :key="step.state"
          :aria-current="record.state === step.state ? 'step' : undefined"
          :class="{ current: record.state === step.state }"
        >
          {{ step.title }}
        </li>
      </ol>
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
        @busy="operationBusy = $event"
        @changed="changed"
      />
      <RecordActions
        v-else
        :key="String(record.id) + action.path"
        :resource-key="resource.key"
        :record="record"
        :action-path="action.path"
        @busy="operationBusy = $event"
        @changed="changed"
        @cancel="back"
      />
    </template>
    <p v-else role="alert">当前状态或权限不允许此操作，请返回列表查看最新状态。</p>
  </component>
</template>

<style scoped>
.workflow-progress {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  padding: 16px 24px;
  border: 1px solid #e1e7f0;
  border-radius: 8px;
  color: #68778b;
}
.workflow-progress .current {
  color: #24559d;
  font-weight: 650;
}
</style>
