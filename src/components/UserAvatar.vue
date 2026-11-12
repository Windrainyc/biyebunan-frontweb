<script setup lang="ts">
import AssetCover from './AssetCover.vue';
defineProps<{ index?: number; assetId?: unknown; size?: number; variant?: string }>();
</script>
<template>
  <span
    class="user-avatar"
    :style="{
      width: `${size || 44}px`,
      height: `${size || 44}px`,
      backgroundImage: variant === 'admin' ? `url('/avatars/admins.png')` : undefined,
      backgroundSize: variant === 'admin' ? '500% 500%' : undefined,
      backgroundPosition: `${((index || 0) % 5) * 25}% ${variant === 'admin' ? ((index || 0) > 4 ? 65 : 13) : (index || 0) > 4 ? 100 : 0}%`,
    }"
    ><AssetCover v-if="assetId" :asset-id="assetId" alt="个人头像"
  /></span>
</template>
<style scoped>
.user-avatar {
  display: inline-block;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  background-image: url('/avatars/students.png');
  background-size: 500% 200%;
  border: 2px solid white;
}
</style>
