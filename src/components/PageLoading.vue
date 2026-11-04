<template>
  <section class="card page-loading" role="status" aria-live="polite">
    <p>正在加载页面，请稍候…</p>
    <div></div>
    <div></div>
    <div></div>
  </section>
</template>
<style scoped>
.page-loading {
  padding: 24px;
}
.page-loading div {
  height: 14px;
  margin: 18px 0;
  border-radius: 6px;
  background: #eaf0f8;
}
.page-loading div:last-child {
  width: 65%;
}
</style>
