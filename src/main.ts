import { createApp } from 'vue';
import { dialog } from './composables/dialog';
import App from './App.vue';
import { router } from './router';
import './styles/main.css';
createApp(App).directive('dialog', dialog).use(router).mount('#app');
