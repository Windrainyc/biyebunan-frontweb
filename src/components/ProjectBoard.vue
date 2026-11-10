<script setup lang="ts">
import { computed } from 'vue';
import type { Row } from '../types/api';
import ReferenceName from './ReferenceName.vue';
import Icon from './Icon.vue';
import StatusBadge from './StatusBadge.vue';
import { display } from '../config/labels';
const props = defineProps<{ rows: Row[]; loading: boolean; failed: boolean }>();
const emit = defineEmits<{ inspect: [row: Row] }>();
const lanes = computed(() =>
  [
    { title: '待启动', stages: ['PENDING', 'REQUIREMENTS', 'PROPOSAL'] },
    { title: '开发中', stages: ['DEVELOPMENT'] },
    { title: '待交付', stages: ['DOCUMENTATION', 'ACCEPTANCE'] },
    { title: '已交付', stages: ['DONE'] },
    { title: '其他阶段', stages: [] },
  ]
    .map((lane) => ({
      ...lane,
      rows: props.rows.filter((row) =>
        lane.stages.length
          ? lane.stages.includes(String(row.stage))
          : ![
              'PENDING',
              'REQUIREMENTS',
              'PROPOSAL',
              'DEVELOPMENT',
              'DOCUMENTATION',
              'ACCEPTANCE',
              'DONE',
            ].includes(String(row.stage)),
      ),
    }))
    .filter((lane) => lane.stages.length || lane.rows.length),
);
const progress = (row: Row) => Math.max(0, Math.min(100, Number(row.progress) || 0));
</script>
<template>
  <div class="project-board" :aria-busy="loading">
    <section v-for="lane in lanes" :key="lane.title" class="project-board-lane">
      <h2>
        {{ lane.title }} <span>{{ lane.rows.length }}</span>
      </h2>
      <article v-for="row in lane.rows" :key="String(row.id)" class="project-board-card">
        <small class="project-board-number">{{ row.projectNo || row.orderNo || 'PROJECT' }}</small
        ><button class="text-button" @click="emit('inspect', row)">{{ row.title }}</button
        ><StatusBadge :value="row.stage" />
        <div class="project-board-progress">
          <span>项目阶段进度</span><strong>{{ progress(row) }}%</strong>
        </div>
        <progress :value="progress(row)" max="100" aria-label="项目阶段进度" />
        <p class="board-card-footer">
          <ReferenceName v-if="row.studentId" field="studentId" :value="row.studentId" /><span
            ><Icon name="calendar" />{{ display(row.deliveryDate) }}</span
          >
        </p>
      </article>
      <p v-if="!lane.rows.length" class="muted">
        {{ loading ? '正在加载…' : failed ? '读取失败，请重试' : '本页暂无此阶段项目' }}
      </p>
    </section>
  </div>
</template>
<style scoped>
.project-board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 18px;
  align-items: start;
}
.project-board-lane {
  min-width: 0;
  background: #f7f8fc;
  border-radius: 14px;
  padding: 12px;
}
.project-board-lane h2 {
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 18px;
}
.project-board-lane h2 span {
  color: #867aa6;
}
.project-board-card {
  padding: 18px 14px;
  margin-bottom: 14px;
  background: white;
  border: 1px solid #eaecf4;
  border-radius: 14px;
}
.project-board-card > button {
  text-align: left;
  display: block;
  font-size: 14px;
  line-height: 1.7;
  margin-bottom: 14px;
  overflow-wrap: anywhere;
}
.project-board-progress {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin-top: 20px;
}
.project-board-card progress {
  width: 100%;
  height: 6px;
  accent-color: #6d5ce8;
}
.project-board-card p,
.project-board-lane > p {
  font-size: 12px;
  line-height: 1.7;
  color: #78798e;
}
@media (max-width: 1100px) {
  .project-board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .project-board {
    grid-template-columns: minmax(0, 1fr);
    padding: 12px;
  }
}
</style>
