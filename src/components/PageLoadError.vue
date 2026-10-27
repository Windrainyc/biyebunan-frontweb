<script setup lang="ts">
function reload() {
  window.location.reload();
}
</script>
<template>
  <section class="card" role="alert" style="padding: 24px">
    <h2>页面暂时无法加载</h2>
    <p>系统可能刚刚更新，或网络连接暂时中断。请确认已保存当前编辑内容后重新加载页面。</p>
    <button class="button primary" @click="reload">重新加载页面</button>
  </section>
</template>
