# 知项平台前端

Vue 3 + TypeScript + Vite，按已确认原型实现管理员、学生、项目中介三个独立入口。当前处于开发接入阶段，不能作为完整交付验收。

## 本地运行

```sh
npm ci
npm run dev
npm run dev:admin
npm run dev:partner
```

- 学生：http://127.0.0.1:18770/student/login
- 管理员：http://127.0.0.1:18771/admin/login
- 中介：http://127.0.0.1:18772/partner/login
- 开发代理：`/api` → `127.0.0.1:18080`。

后端须配置对应的精确 Origin；正式部署建议三个独立域名。客户端入口不能改变服务端身份或数据范围。访问令牌仅存内存，刷新令牌由服务端HttpOnly Cookie管理。

## 验证

```sh
npm run build
npm test
```

目前类型检查和构建通过，68项协议/会话/表单/导航测试通过。登录页已在真实浏览器检查；管理员MFA登录、刷新恢复、院校新增编辑搜索、专业关联保存已通过真实浏览器；尚未完成三端全流程浏览器验收，不能把模拟请求单元测试视为端到端测试。

## 已接入与待完成

已接入三端登录、注册/邀请激活/重置密码页面、权限导航、分页搜索排序、基础表单增改删、数据详情、学生模型目录及会话/流式问答。协议层处理同次写入幂等键、CAS版本、刷新并发合并、退出后的迟到结果拒绝、SSE跨分片解析与断线回放。

已完成附件直传、真实扫描、交付发布与学生私有下载、知识发布撤回与检索、引用问答和刷新恢复账务浏览器验证。仍需更多边界与权限负例、剩余子列表交互和完整验收，不能以路由数量视为完成。

注册与中介激活依赖合法发布的服务协议：在`.env.local`配置`VITE_TERMS_URL`和与后端一致的`VITE_TERMS_VERSION`。没有协议时页面明确阻止完成，不能伪造已经同意的条款。短信、模型不可用时展示实际后端错误，不提供假成功。

图标来自原型使用的阿里巴巴Fusion字体，许可和来源见public/assets。契约由scripts/generate-contract.py从后端生成，请使用架构目录中的Python虚拟环境运行。


## 一键启动已有隔离联调环境

先按后端说明准备独立UI验证数据库、保护凭据及Maven制品，启动本地中间件。脚本不会创建数据库、删除数据卷或接管未知进程。

```sh
python3 scripts/stackctl.py start --build
python3 scripts/stackctl.py status
python3 scripts/stackctl.py stop
```

启动三端独立Nginx镜像及本机API/worker JAR，API/worker使用隔离数据库和专用RabbitMQ vhost。学生入口 `http://127.0.0.1:18780/student/login`、管理员 `http://127.0.0.1:18781/admin/login`、中介 `http://127.0.0.1:18782/partner/login`；API18080。默认外部短信和模型关闭。

仅在本机协议联调时使用 `start --fixtures`，显式启用本机HTTPS短信与确定性模型服务，不连接付费供应商。凭据位置以后端docs/ui-verification-state.json为准，勿提交或粘贴到报告。此模式切换后端精确Origin到18780/18781/18782，开发端18770/18771/18772的认证写入不再接受；要回到Vite模式须停止本入口并按后端开发说明恢复API。

停止时只终止记录且身份一致的进程、停止zhixiang-ui容器，不清空卷、不停止中间件。日志在.runtime/stack和后端受保护目录。当前组合使用前端容器与宿主API/worker；独立API/worker镜像另经启动验证，不等于已实现跨主机高可用。

本机视频联调可使用 `python3 scripts/stackctl.py start --fixtures --video`；`--video` 要求已安装 FFmpeg/ffprobe，显式启用隔离 worker 转码，默认关闭。该模式不启用 ASR/OCR。

注册与中介激活需要运营方确认的真实服务协议地址和版本。容器构建从环境变量 `VITE_TERMS_URL`、`VITE_TERMS_VERSION` 读取，修改后执行 `docker --context colima-zhixiang compose -p zhixiang-ui -f deploy/compose.yaml build` 并 `up -d`。地址要求HTTPS（仅本机联调允许localhost HTTP），不允许嵌入凭据；两个值缺失或不合法时按钮保持禁用。版本须与后端接受的版本一致。这里不提供虚构协议，也不会自动替用户勾选同意。

用户已授权配置本地测试说明：`start --fixtures`自动将前端地址设为`http://127.0.0.1:18780/local-test-terms.html`，版本`ui-test-nonbinding`，与测试API一致，并重建镜像防止旧配置残留。该说明非商业协议且仅用于隔离测试；普通模式仍须自行配置正式协议。不要把测试镜像发布到生产。
