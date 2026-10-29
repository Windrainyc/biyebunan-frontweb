<script setup lang="ts">
import { computed, useId } from 'vue';
import { iconPaths } from './icon-paths';
/** 默认D线面图标；首页业务卡片显式选择A棱镜图标。 */
const props = withDefaults(defineProps<{ name: string; variant?: 'spectrum' | 'prism' }>(), {
  variant: 'spectrum',
});
const id = useId().replace(/[^a-zA-Z0-9-]/g, '');
const gradient = `zx-icon-${id}`;
const path = computed(() => iconPaths[props.name] ?? iconPaths.file);
const simple = computed(() =>
  [
    'plus',
    'down',
    'right',
    'left',
    'menu',
    'close',
    'check',
    'refresh',
    'logout',
    'download',
    'upload',
  ].includes(props.name),
);
</script>
<template>
  <span class="ali-icon zx-icon" :class="`zx-icon--${variant}`" aria-hidden="true">
    <svg
      class="zx-icon-art"
      :class="`zx-icon--${variant}`"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      :data-icon="name"
    >
      <defs>
        <linearGradient :id="gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#28c7ee" />
          <stop offset="0.52" :stop-color="variant === 'prism' ? '#3464f5' : '#9192f5'" />
          <stop offset="1" :stop-color="variant === 'prism' ? '#7045e5' : '#ff9aaf'" />
        </linearGradient>
      </defs>
      <path
        v-if="!simple"
        :d="path"
        :fill="`url(#${gradient})`"
        :fill-opacity="variant === 'prism' ? 0.92 : 0.25"
        fill-rule="evenodd"
      />
      <path
        :d="path"
        :stroke="variant === 'prism' ? '#3043b8' : 'currentColor'"
        :stroke-width="variant === 'prism' ? 1.25 : 1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        v-if="variant === 'prism' && !simple"
        d="m5 5 13 13"
        stroke="white"
        stroke-opacity=".3"
        stroke-width="1"
      />
    </svg>
  </span>
</template>
<style scoped>
.zx-icon {
  align-items: center;
  justify-content: center;
  overflow: visible;
  vertical-align: -0.125em;
  color: var(--zx-icon-ink, #39498c);
}
.zx-icon-art {
  width: 1em;
  height: 1em;
  overflow: visible;
  flex: none;
}
.zx-icon--prism {
  filter: drop-shadow(0 2px 2px rgb(66 88 177 / 12%));
}
:global(.btn.primary) .zx-icon,
:global(.button.primary) .zx-icon {
  color: inherit;
}
:global(button:disabled) .zx-icon {
  opacity: 0.55;
}
</style>
