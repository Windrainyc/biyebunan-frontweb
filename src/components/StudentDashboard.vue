<script setup lang="ts">
import { computed } from 'vue';
import { auth } from '../api/client';
import { display } from '../config/labels';
import type { Row } from '../types/api';
import Icon from './Icon.vue';
import orbit from '../assets/project-orbit.svg';
const props = defineProps<{
  project?: Row;
  milestones: Row[];
  deliveries: Row[];
  learning: Row[];
  loading: boolean;
  error: string;
  visiblePaths: string[];
}>();
defineEmits<{ refresh: [] }>();
const visible = (key: string) => props.visiblePaths.includes('/student/' + key);
const link = (section = 'deliveries') => ({
  path: '/student/projects',
  query: props.project ? { view: String(props.project.id), section } : {},
});
const stages = [
  'PENDING',
  'REQUIREMENTS',
  'PROPOSAL',
  'DEVELOPMENT',
  'DOCUMENTATION',
  'ACCEPTANCE',
  'DONE',
];
const stageIndex = computed(() => stages.indexOf(String(props.project?.stage)));
const pending = computed(() => props.milestones.filter((item) => !item.completed));
const date = new Date();
const dateMonth = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'long',
}).format(date);
const dateDay = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', day: '2-digit' })
  .format(date)
  .replace('日', '');
const weekday = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  weekday: 'long',
}).format(date);
</script>
<template>
  <section class="prototype-home">
    <div class="page-intro">
      <div>
        <p class="eyebrow">每一个小进展，都值得被看见</p>
        <div class="greeting">
          <h1>
            <span>嗨，{{ auth.user?.displayName }}。</span><span>今天也向前一步</span>
          </h1>
          <Icon name="sparkles" />
        </div>
        <p class="intro-sub">项目有进展，问题有回应。把注意力留给真正想做的事。</p>
      </div>
      <div class="date-chip">
        <b>{{ dateDay }}</b
        ><span>{{ dateMonth }}<br />{{ weekday }}</span
        ><button
          class="refresh"
          aria-label="刷新工作台"
          :disabled="loading"
          @click="$emit('refresh')"
        >
          <Icon name="refresh" />
        </button>
      </div>
    </div>
    <p v-if="error" class="error" role="alert">
      {{ error }} <button @click="$emit('refresh')">重试</button>
    </p>
    <p v-if="loading" class="loading" role="status">正在读取工作台数据…</p>
    <div class="dashboard-top">
      <article class="hero">
        <div class="hero-top">
          <span class="hero-label"
            ><i></i>{{ project ? '正在推进的项目' : '准备开始新的项目' }}</span
          ><span v-if="project" class="pill">{{ display(project.stage) }}</span>
        </div>
        <div class="hero-copy">
          <h2>{{ project?.title || '让每一个好想法' }}<br />让想法，<em>成为作品。</em></h2>
          <p>
            {{
              project ? '计划交付 ' + display(project.deliveryDate) : '绑定订单，开始你的项目之旅。'
            }}
          </p>
          <div class="hero-actions">
            <RouterLink v-if="visible('projects') && project" class="btn" :to="link()"
              >继续我的项目 <Icon name="right" /></RouterLink
            ><RouterLink v-else-if="visible('bind-order')" class="btn" to="/student/bind-order"
              >绑定新项目 <Icon name="plus" /></RouterLink
            ><RouterLink v-if="project" class="hero-secondary" :to="link('overview')"
              >查看进度 <Icon name="right"
            /></RouterLink>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <img :src="orbit" alt="" /><span>进步正在发生 <Icon name="right" /></span>
        </div>
        <ol v-if="project" class="hero-foot" aria-label="项目阶段">
          <li
            v-for="(stage, index) in stages"
            :key="stage"
            :class="{ done: index < stageIndex, active: index === stageIndex }"
          >
            <span
              ><Icon v-if="index < stageIndex" name="check" /><template v-else>{{
                index + 1
              }}</template></span
            >{{ display(stage) }}
          </li>
        </ol>
      </article>
      <aside class="task-card card">
        <div class="task-heading">
          <h2>接下来，做这几件事</h2>
          <span>{{ pending.length }} 待办</span>
        </div>
        <p class="task-sub">一步一步来，比想象中更接近终点。</p>
        <div class="task-list">
          <RouterLink v-if="project" class="task-row" :to="link()"
            ><Icon name="file" />
            <div>
              <strong>查看最新交付版本</strong
              ><small>{{
                deliveries.length ? '查看项目资料与交付文件' : '发布后可在这里查看项目资料'
              }}</small>
            </div></RouterLink
          ><RouterLink
            v-if="visible('chat')"
            class="task-row"
            :to="{ path: '/student/chat', query: project ? { projectId: String(project.id) } : {} }"
            ><Icon name="message" />
            <div>
              <strong>梳理项目中的问题</strong><small>带上代码，让 AI 帮你一起分析</small>
            </div></RouterLink
          ><RouterLink
            v-for="item in pending.slice(0, 2)"
            :key="String(item.id)"
            class="task-row"
            :to="link('overview')"
            ><Icon name="clock" />
            <div>
              <strong>{{ item.name }}</strong
              ><small>{{ display(item.dueDate) }}</small>
            </div></RouterLink
          >
        </div>
        <div class="task-bottom">
          <span>{{ pending.length ? '按计划推进，继续保持' : '当前没有待完成的里程碑' }}</span
          ><RouterLink v-if="project" :to="link('overview')">查看进度</RouterLink>
        </div>
      </aside>
    </div>
    <div class="section-head">
      <h2>你的项目加速器 <small>需要的，都在这里</small></h2>
      <RouterLink v-if="visible('bind-order')" to="/student/bind-order"
        >绑定新项目 <Icon name="plus"
      /></RouterLink>
    </div>
    <div class="tools-grid">
      <RouterLink v-if="visible('projects')" :to="link()" class="card tool-card"
        ><span class="tile-icon"><Icon name="folder" /></span>
        <h3>每一次交付，都有迹可循</h3>
        <p>项目资料、源代码和演示，一站收好。</p>
        <div class="file-mini" aria-hidden="true"></div>
        <div class="card-bottom">
          <span>查看项目版本与文件</span><i><Icon name="right" /></i></div></RouterLink
      ><RouterLink v-if="visible('chat')" to="/student/chat" class="card tool-card ai"
        ><span class="tile-icon"><Icon name="sparkles" /></span>
        <h3>卡住了？我们一起想</h3>
        <p>带着项目上下文，得到更有用的回答。</p>
        <svg class="mini-star" viewBox="0 0 100 100" aria-hidden="true">
          <path
            d="M50 0 61 29 85 15 71 39 100 50 71 61 85 85 61 71 50 100 39 71 15 85 29 61 0 50 29 39 15 15 39 29Z"
            fill="currentColor"
          />
        </svg>
        <div class="card-bottom">
          <span>AI 答疑 · 基于你的项目资料</span><i><Icon name="right" /></i></div></RouterLink
      ><RouterLink v-if="visible('posts')" to="/student/posts" class="card tool-card community"
        ><span class="tile-icon"><Icon name="message" /></span>
        <h3>不是一个人在通关</h3>
        <p>交换灵感，也分享解决问题的瞬间。</p>
        <div class="community-art" aria-hidden="true">
          <span v-for="n in 3" :key="n"
            ><svg viewBox="0 0 24 24">
              <path d="M7 12q5 6 10 0" fill="none" stroke="currentColor" /></svg
          ></span>
        </div>
        <div class="card-bottom">
          <span>看看同学们正在聊什么</span><i><Icon name="right" /></i></div
      ></RouterLink>
    </div>
    <div class="bottom-grid">
      <section>
        <div class="section-head">
          <h2>刚好用得上</h2>
          <RouterLink to="/student/knowledge">去知识库 <Icon name="right" /></RouterLink>
        </div>
        <div class="card resource-list">
          <RouterLink
            v-for="item in learning.slice(0, 2)"
            :key="String(item.id)"
            :to="{ path: '/student/knowledge', query: { view: String(item.id) } }"
            class="resource-row"
            ><span class="resource-icon"><Icon name="book" /></span>
            <div>
              <h3>{{ item.title }}</h3>
              <p>{{ display(item.type || item.contentType) }}</p>
            </div>
            <Icon name="right"
          /></RouterLink>
          <p v-if="!learning.length" class="empty">
            {{ loading ? '正在读取资料…' : '暂无可访问的知识资料' }}
          </p>
        </div>
      </section>
      <section>
        <div class="section-head"><h2>给今天的一点灵感</h2></div>
        <article class="card tip-card">
          <span class="quote" aria-hidden="true">“</span>
          <h3>不用一次搞定整个项目。</h3>
          <p>把眼前的问题拆成一个可以开始的小动作。<br />完成它，你就已经往前走了一步。</p>
          <div class="tip-foot"><Icon name="sparkles" />知项，陪你把想法做出来。</div>
        </article>
      </section>
    </div>
    <footer>知项 · 让想法发生，让成长有迹可循。</footer>
  </section>
</template>
<style scoped>
.prototype-home {
  color: #262840;
  font-family: var(--serif);
  --line: #e0e3f4;
}
h1,
h2,
h3,
p {
  margin: 0;
}
a {
  color: inherit;
  text-decoration: none;
}
.page-intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 26px;
}
.eyebrow {
  font-size: 11px;
  letter-spacing: 2px;
  color: #6a6c8a;
  margin-bottom: 8px;
}
.greeting {
  display: flex;
  gap: 12px;
  align-items: center;
}
.greeting h1 {
  font-size: 34px;
  line-height: 1.55;
  font-weight: 700;
}
.greeting > .ali-icon {
  color: #9e80df;
  font-size: 26px;
}
.intro-sub {
  margin-top: 8px;
  color: #696a89;
  font-size: 13px;
}
.date-chip {
  display: flex;
  gap: 12px;
  align-items: center;
  padding-bottom: 4px;
}
.date-chip b {
  font-size: 24px;
  line-height: 1;
}
.date-chip > span {
  border-left: 1px solid var(--line);
  padding-left: 12px;
  font-size: 11px;
  color: #6a6c8a;
}
.refresh {
  padding: 4px;
  border: 0;
  background: none;
  color: #6a6c8a;
}
.dashboard-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
}
.card {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 22px;
}
.hero {
  position: relative;
  overflow: hidden;
  min-height: 359px;
  border-radius: 24px;
  background: linear-gradient(115deg, #eeeaff, #f4edfa 72%, #fff0f3);
  border: 1px solid #dfd8fa;
  padding: 29px 32px 25px;
  display: flex;
  flex-direction: column;
}
.hero-top,
.hero-copy,
.hero-foot {
  position: relative;
  z-index: 2;
}
.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hero-label {
  font-size: 11px;
  letter-spacing: 1px;
  color: #777293;
  display: flex;
  align-items: center;
  gap: 7px;
}
.hero-label i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9175e6;
}
.pill {
  padding: 4px 11px;
  background: #e6e0f8;
  color: #6e5baf;
  border: 1px solid #d8cef7;
  border-radius: 20px;
  font-size: 11px;
}
.hero-copy {
  margin-top: 25px;
  max-width: 68%;
}
.hero h2 {
  font-size: 29px;
  line-height: 1.55;
  font-weight: 600;
  letter-spacing: -0.7px;
  overflow-wrap: anywhere;
}
.hero h2 em {
  font-style: normal;
  color: #7053dc;
}
.hero-copy p {
  font-size: 12px;
  color: #77728e;
  margin-top: 10px;
}
.hero-actions {
  margin-top: 22px;
  display: flex;
  align-items: center;
  gap: 19px;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  background: #6957e9;
  color: white;
  padding: 12px 17px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}
.hero-secondary {
  font-size: 12px;
  color: #72668b;
  display: flex;
  align-items: center;
  gap: 4px;
}
.hero-art {
  position: absolute;
  width: 275px;
  height: 260px;
  right: 23px;
  top: 47px;
  z-index: 1;
  pointer-events: none;
}
.hero-art img {
  width: 100%;
  height: 100%;
}
.hero-art > span {
  position: absolute;
  bottom: 16px;
  right: 12px;
  background: #fff9;
  border: 1px solid #e5d4f2;
  color: #8a759c;
  border-radius: 7px;
  font-size: 10px;
  padding: 6px 11px;
  transform: rotate(-6deg);
}
.hero-foot {
  display: flex;
  align-items: center;
  margin: auto 0 0;
  padding: 26px 0 0;
  list-style: none;
}
.hero-foot li {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10px;
  color: #8a7f9e;
  flex: 1;
  position: relative;
  white-space: nowrap;
}
.hero-foot li:last-child {
  flex: 0;
}
.hero-foot li:not(:last-child)::after {
  content: '';
  height: 1px;
  background: #d7ccee;
  flex: 1;
  margin-right: 13px;
  margin-left: 5px;
}
.hero-foot li > span {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid #d0c2eb;
  border-radius: 50%;
  font-size: 10px;
  flex-shrink: 0;
}
.hero-foot li.active {
  color: #7053dc;
}
.hero-foot li.active > span {
  background: #8062d9;
  border-color: #8062d9;
  color: white;
}
.hero-foot li.done > span {
  background: #dfd6f5;
  border: 0;
}
.task-card {
  padding: 24px 23px 18px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.task-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.task-heading h2 {
  font-size: 17px;
}
.task-heading > span {
  font-size: 11px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 1px 7px;
  color: #6a6c8a;
  white-space: nowrap;
}
.task-sub {
  font-size: 11px;
  color: #6a6c8a;
  margin-top: 7px;
}
.task-list {
  margin-top: 15px;
}
.task-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px 0;
  border-bottom: 1px solid #e9eaf6;
}
.task-row:last-child {
  border: 0;
}
.task-row > .ali-icon {
  color: #9581c7;
  border: 1px solid #ded8ef;
  border-radius: 6px;
  padding: 3px;
}
.task-row strong {
  font-size: 12px;
  font-weight: 550;
}
.task-row small {
  display: block;
  font-size: 10px;
  color: #6a6c8a;
  margin-top: 3px;
}
.task-bottom {
  margin-top: auto;
  padding-top: 14px;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #6a6c8a;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 27px 0 14px;
}
.section-head h2 {
  font-size: 17px;
}
.section-head small {
  font-weight: 400;
  font-size: 11px;
  color: #6a6c8a;
  margin-left: 10px;
}
.section-head > a {
  font-size: 12px;
  color: #646582;
  display: flex;
  gap: 10px;
  align-items: center;
}
.tools-grid {
  display: grid;
  grid-template-columns: 1.03fr 1.03fr 1fr;
  gap: 20px;
}
.tool-card {
  padding: 22px 24px;
  min-height: 189px;
  position: relative;
  overflow: hidden;
}
.tile-icon {
  height: 34px;
  width: 34px;
  border: 1px solid #dadcf7;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #8084bb;
  background: #f1f3ff;
}
.tool-card h3 {
  margin-top: 13px;
  font-size: 16px;
}
.tool-card p {
  font-size: 11px;
  color: #6a6c8a;
  margin-top: 5px;
}
.card-bottom {
  margin-top: 19px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #686988;
}
.card-bottom i {
  width: 29px;
  height: 29px;
  border-radius: 50%;
  border: 1px solid #dadcf7;
  display: grid;
  place-items: center;
}
.tool-card.ai {
  background: #f0ebff;
  border-color: #e4daff;
}
.ai .tile-icon,
.ai .card-bottom i {
  background: #9274d9;
  color: white;
  border: none;
}
.mini-star {
  position: absolute;
  right: 34px;
  top: 35px;
  width: 62px;
  height: 62px;
  transform: rotate(11deg);
  color: #c5b3ee;
}
.file-mini {
  position: absolute;
  top: 37px;
  right: 26px;
  width: 57px;
  height: 68px;
  background: #eef0ff;
  border-radius: 9px;
  border: 1px solid #dadcf7;
  transform: rotate(9deg);
}
.file-mini:after {
  content: '';
  position: absolute;
  top: 25px;
  left: 12px;
  right: 12px;
  height: 3px;
  border-radius: 3px;
  background: #c4c7ea;
  box-shadow:
    0 10px #c4c7ea,
    0 20px #d4d6ef;
}
.tool-card.community {
  background: #fff6ef;
  border-color: #f4e4d8;
}
.community-art {
  position: absolute;
  right: 25px;
  top: 40px;
  display: flex;
  transform: rotate(-8deg);
}
.community-art span {
  width: 35px;
  height: 35px;
  border-radius: 50%;
  background: #e8dcff;
  display: grid;
  place-items: center;
  border: 3px solid #fff6ef;
  margin-left: -8px;
}
.community-art span:nth-child(2) {
  background: #ffdbca;
}
.community-art span:nth-child(3) {
  background: #fce7b8;
}
.community-art svg {
  width: 24px;
  height: 24px;
}
.bottom-grid {
  display: grid;
  grid-template-columns: 1.65fr 1fr;
  gap: 24px;
}
.resource-list {
  padding: 4px 20px;
}
.resource-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 2px;
  border-bottom: 1px solid var(--line);
}
.resource-row:last-child {
  border: 0;
}
.resource-icon {
  height: 39px;
  width: 39px;
  border-radius: 10px;
  background: #eff0fc;
  display: grid;
  place-items: center;
  color: #8388bc;
  flex-shrink: 0;
}
.resource-row > div {
  flex: 1;
  min-width: 0;
}
.resource-row h3 {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.resource-row p {
  font-size: 10px;
  color: #6a6c8a;
  margin-top: 2px;
}
.resource-row > .ali-icon {
  color: #6a6c8a;
}
.tip-card {
  padding: 22px 24px;
  background: #fff4eb;
  min-height: 160px;
  border-color: #f0e1d3;
  position: relative;
  color: #806a5c;
}
.tip-card h3 {
  font-size: 13px;
}
.tip-card p {
  font-size: 12px;
  line-height: 1.9;
  margin-top: 9px;
  max-width: 85%;
}
.quote {
  position: absolute;
  right: 22px;
  top: 8px;
  font:
    80px/1 Georgia,
    serif;
  color: #eecdb9;
}
.tip-foot {
  font-size: 10px;
  display: flex;
  gap: 7px;
  align-items: center;
  margin-top: 15px;
}
footer {
  padding-top: 32px;
  font-size: 10px;
  color: #6a6c8a;
}
.empty,
.loading {
  padding: 16px;
  font-size: 12px;
  color: #6a6c8a;
}
@media (max-width: 1100px) {
  .dashboard-top {
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 16px;
  }
  .hero {
    padding: 23px;
  }
  .hero-art {
    width: 190px;
    top: 85px;
    right: 0;
  }
  .hero h2 {
    font-size: 24px;
  }
  .hero-copy {
    max-width: 75%;
  }
  .hero-foot li {
    font-size: 9px;
    gap: 4px;
  }
  .hero-foot li:not(:last-child)::after {
    margin: 0 6px;
  }
  .task-card {
    padding: 22px 18px;
  }
  .tool-card {
    padding: 20px;
  }
  .tool-card h3 {
    font-size: 14px;
  }
  .tools-grid {
    gap: 15px;
  }
}
@media (max-width: 850px) {
  .dashboard-top {
    grid-template-columns: 1fr;
  }
  .hero {
    min-height: 353px;
  }
  .hero-art {
    width: 250px;
    height: 240px;
    right: 20px;
    top: 65px;
  }
  .task-card {
    min-height: auto;
  }
  .date-chip {
    display: none;
  }
  .hero-copy {
    max-width: 65%;
  }
  .task-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 17px;
  }
  .bottom-grid {
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }
  .file-mini,
  .mini-star,
  .community-art {
    opacity: 0.5;
  }
  .tool-card h3 {
    position: relative;
    z-index: 1;
  }
}
@media (max-width: 600px) {
  .page-intro {
    margin-bottom: 20px;
  }
  .greeting {
    gap: 7px;
    align-items: flex-start;
  }
  .greeting h1 {
    font-size: 27px;
  }
  .greeting h1 span {
    display: block;
  }
  .greeting > .ali-icon {
    font-size: 23px;
    margin-top: 5px;
  }
  .eyebrow {
    font-size: 9px;
    letter-spacing: 1.5px;
  }
  .intro-sub {
    font-size: 11px;
  }
  .hero {
    padding: 22px;
    min-height: 376px;
    border-radius: 20px;
  }
  .hero-copy {
    max-width: 90%;
    margin-top: 23px;
  }
  .hero h2 {
    font-size: 27px;
    line-height: 1.6;
  }
  .hero-copy p {
    font-size: 11px;
    max-width: 200px;
  }
  .hero-art {
    right: -60px;
    top: 110px;
    width: 220px;
    opacity: 0.75;
  }
  .hero-art > span {
    display: none;
  }
  .hero-label {
    font-size: 9px;
  }
  .pill {
    font-size: 9px;
  }
  .hero-actions {
    gap: 10px;
  }
  .hero-actions .btn {
    padding: 10px 14px;
    font-size: 11px;
  }
  .hero-secondary {
    font-size: 10px;
  }
  .hero-foot {
    align-items: flex-start;
    justify-content: space-between;
    gap: 3px;
    padding-top: 30px;
  }
  .hero-foot li {
    flex: 1;
    flex-direction: column;
    gap: 7px;
    font-size: 8px;
    white-space: normal;
    text-align: center;
  }
  .hero-foot li:last-child {
    flex: 1;
  }
  .hero-foot li:not(:last-child)::after {
    position: absolute;
    left: 75%;
    right: -25%;
    top: 9px;
    margin: 0;
  }
  .hero-foot li > span {
    width: 18px;
    height: 18px;
  }
  .task-card {
    padding: 20px;
  }
  .task-list {
    display: block;
    margin-top: 9px;
  }
  .task-row {
    padding: 10px 0;
  }
  .section-head {
    margin: 23px 0 12px;
  }
  .section-head h2 {
    font-size: 16px;
  }
  .section-head small {
    font-size: 9px;
    margin-left: 6px;
  }
  .section-head > a {
    font-size: 10px;
    gap: 4px;
  }
  .tools-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .tool-card {
    padding: 19px 21px;
    min-height: 157px;
    border-radius: 18px;
  }
  .tool-card h3 {
    font-size: 15px;
    margin: 0 0 0 47px;
    padding-top: 2px;
  }
  .tile-icon {
    position: absolute;
    top: 19px;
    left: 21px;
  }
  .tool-card p {
    font-size: 11px;
    margin: 5px 0 0 47px;
  }
  .card-bottom {
    margin-top: 28px;
    font-size: 10px;
  }
  .mini-star {
    right: 28px;
    top: 66px;
    width: 45px;
    height: 45px;
    opacity: 1;
  }
  .file-mini {
    right: 29px;
    top: 66px;
    width: 34px;
    height: 44px;
    opacity: 1;
  }
  .file-mini:after {
    top: 15px;
    left: 8px;
    right: 8px;
    height: 2px;
    box-shadow:
      0 8px #c4c7ea,
      0 16px #d4d6ef;
  }
  .community-art {
    right: 27px;
    top: 80px;
    opacity: 1;
  }
  .community-art span {
    width: 26px;
    height: 26px;
    border-width: 2px;
  }
  .bottom-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .resource-list {
    padding: 4px 17px;
  }
  .tip-card {
    min-height: 147px;
    border-radius: 18px;
  }
  .tip-card p {
    max-width: 90%;
  }
  footer {
    padding-top: 25px;
    font-size: 9px;
  }
}
</style>
