import type { Plugin } from 'vite';

const origin = 'https://biyebunan.com';
const guide = '/guides/vue-history-refresh.html';

function page(title: string, description: string, path: string, body: string) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${origin}${path}"><style>body{max-width:48rem;margin:auto;padding:clamp(20px,6vw,80px) 24px;color:#202638;font:16px/1.75 system-ui,sans-serif}nav{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:1rem}h1{line-height:1.25}a{color:#423786}pre{overflow:auto;background:#f5f5f8;padding:1em}</style></head><body><nav><a href="/">知项 · 毕业不难</a><a href="/student/login">进入学生端</a></nav><main>${body}</main></body></html>`;
}

export function publicSearch(mode: string): Plugin {
  return {
    name: 'zhixiang-public-search',
    generateBundle() {
      const asset = (fileName: string, source: string) => this.emitFile({type:'asset',fileName,source});
      if (mode !== 'student') {
        asset('robots.txt', 'User-agent: *\nDisallow: /\n');
        return;
      }
      const question = 'Vue 项目部署到 Nginx 后，为什么刷新子页面会出现 404？';
      asset('public-home.html',page('知项 · 毕业不难｜项目开发与部署指南','知项分享项目开发与部署经验，学生可登录查看项目进度、知识资料和答疑记录。','/',`<h1>知项 · 毕业不难</h1><p>在这里阅读项目开发与部署经验。登录学生端可查看自己的项目进度、知识资料和答疑记录。</p><h2>部署指南</h2><a href="${guide}">${question}</a>`));
      asset(guide.slice(1),page(question+'｜知项','区分前端路由、静态资源和 API 的 404，并验证 Nginx 的入口回退配置。',guide,`<article><h1>${question}</h1><p>从首页点击链接能打开详情，复制详情地址到新标签却出现 Nginx 404，可以先检查 History 路由的入口回退。</p><h2>先看哪个请求失败</h2><p>打开浏览器开发者工具的网络面板，刷新页面。若失败的是文档请求，检查站点根目录和路由回退。若文档已返回 200，但脚本加载失败，检查构建产物路径。若只有接口失败，检查接口地址和反向代理。</p><h2>为前端路由提供入口</h2><p>下面的示例适用于应用部署在域名根路径、静态资源位于 assets 目录的情况。API 使用独立的代理规则。</p><pre><code>location /assets/ {
    try_files $uri =404;
}
location / {
    try_files $uri $uri/ /index.html;
}</code></pre><h2>验证修改</h2><p>执行 nginx -t 检查语法，通过后平滑重载。直接访问一条真实的详情路由，检查页面是否显示正确内容。再请求一个不存在的脚本，确认返回 404，以免浏览器把 HTML 当作 JavaScript 加载。</p></article>`));
      asset('robots.txt',`User-agent: *\nDisallow: /api/\nDisallow: /student/\nSitemap: ${origin}/sitemap.xml\n`);
      asset('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/',guide].map(path=>'<url><loc>'+origin+path+'</loc></url>').join('')}</urlset>`);
    }
  };
}
