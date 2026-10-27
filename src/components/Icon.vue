<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ name: string }>();
const codes: Record<string, string> = {
  search: 'E656',
  bell: 'E60C',
  plus: 'E655',
  down: 'E63D',
  right: 'E619',
  left: 'E61D',
  menu: 'E7F9',
  close: 'E626',
  check: 'E632',
  clock: 'E621',
  info: 'E60C',
  calendar: 'E607',
  download: 'E628',
  upload: 'E7EE',
  refresh: 'E677',
  settings: 'E683',
  logout: 'E616',
  user: 'E608',
  users: 'E608',
  book: 'E7FB',
  message: 'E7F8',
  sparkles: 'E673',
  folder: 'E665',
  file: 'E7FB',
  video: 'E631',
  database: 'E606',
  cloud: 'E7EE',
  globe: 'E7FA',
  key: 'E615',
  tag: 'E665',
  grid: 'E7FA',
  bag: 'E606',
  activity: 'E612',
  wallet: 'E606',
  cpu: 'E683',
  shield: 'E617',
  star: 'E60E',
  eye: 'E611',
  send: 'E619',
  lock: 'E617',
  edit: 'E63B',
  trash: 'E639',
};
const glyph = computed(() => String.fromCodePoint(parseInt(codes[props.name] || codes.file, 16)));
</script>
<template>
  <i class="ali-icon" aria-hidden="true">{{ glyph }}</i>
</template>
