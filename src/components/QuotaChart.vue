<script setup lang="ts">
import { computed } from 'vue';
import type { Row } from '../types/api';
const props = defineProps<{ quota: Row; compact?: boolean }>();
const available = computed(() => Math.max(0, Number(props.quota.availableTokens) || 0));
const reserved = computed(() => Math.max(0, Number(props.quota.reservedTokens) || 0));
const percent = computed(() =>
  available.value + reserved.value
    ? (available.value / (available.value + reserved.value)) * 100
    : 0,
);
const number = (value: unknown) => Number(value || 0).toLocaleString('zh-CN');
</script>
<template>
  <div class="quota-chart" :class="{ compact }">
    <div
      class="quota-ring"
      :style="{ background: `conic-gradient(#315cde ${percent}%, #dce5fb 0)` }"
      role="img"
      :aria-label="`可用词元${available}，预占词元${reserved}`"
    >
      <div>
        <strong>{{ number(available) }}</strong
        ><small>可用词元</small>
      </div>
    </div>
    <div class="quota-legend">
      <p>
        <i></i>可用 <b>{{ number(available) }}</b>
      </p>
      <p>
        <i class="reserved"></i>预占 <b>{{ number(reserved) }}</b>
      </p>
      <template v-if="!compact"
        ><p>
          可用金额 <b>¥ {{ number(quota.availableAmount) }}</b>
        </p>
        <p>
          预占金额 <b>¥ {{ number(quota.reservedAmount) }}</b>
        </p></template
      >
    </div>
    <small v-if="!compact" class="quota-caption"
      >图表展示当前可用与预占的比例，不代表累计使用率。</small
    >
  </div>
</template>
<style scoped>
.quota-chart {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 24px;
  margin-top: 20px;
}
.quota-ring {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.quota-ring > div {
  width: 116px;
  height: 116px;
  background: white;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.quota-ring strong {
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}
.quota-ring small,
.quota-caption {
  color: #7d8ba4;
  font-size: 12px;
}
.quota-legend {
  min-width: 0;
}
.quota-legend p {
  font-size: 13px;
  margin: 12px 0;
}
.quota-legend b {
  margin-left: 8px;
  overflow-wrap: anywhere;
}
.quota-legend i {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #315cde;
  border-radius: 50%;
  margin-right: 8px;
}
.quota-legend .reserved {
  background: #dce5fb;
}
.quota-caption {
  flex-basis: 100%;
  line-height: 1.7;
}
.compact {
  gap: 12px;
}
.compact .quota-ring {
  width: 70px;
  height: 70px;
}
.compact .quota-ring > div {
  width: 55px;
  height: 55px;
  gap: 3px;
}
.compact .quota-ring strong {
  font-size: 12px;
}
.compact .quota-ring small {
  font-size: 9px;
}
.compact .quota-legend b {
  margin-left: 4px;
}
.compact .quota-legend i {
  margin-right: 4px;
  width: 6px;
  height: 6px;
}
.compact .quota-legend p {
  font-size: 11px;
}
</style>
