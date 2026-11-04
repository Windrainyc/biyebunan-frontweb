<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  CanvasRenderer,
]);
const props = defineProps<{ option: echarts.EChartsCoreOption; label: string }>();
const el = ref<HTMLDivElement>();
let chart: echarts.EChartsType | undefined, observer: ResizeObserver | undefined;
onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value);
  chart.setOption(props.option);
  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(el.value);
});
watch(
  () => props.option,
  (value) => chart?.setOption(value, true),
  { deep: true },
);
onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
});
</script>
<template><div ref="el" class="data-chart" role="img" :aria-label="label" /></template>
<style scoped>
.data-chart {
  height: 260px;
  width: 100%;
  min-width: 0;
}
@media (max-width: 600px) {
  .data-chart {
    height: 260px;
  }
}
</style>
