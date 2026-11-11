<script setup lang="ts">
import SiteRegistration from './components/SiteRegistration.vue';
import { useActivity } from './composables/useActivity';
useActivity();
import { useRoute } from 'vue-router';
const route = useRoute();
</script>
<template>
  <p v-if="!route.matched.length" role="status" style="padding: 32px">正在连接知项平台…</p>
  <RouterView />
  <SiteRegistration />
</template>
