# 三端运行与容器化

## 本地开发

安装Node 22和本工程锁定依赖后，在前端目录执行`npm ci`，再执行`python3 scripts/frontctl.py start`，分别访问学生18770、管理员18771、中介18772。`status`检查进程和HTTP，`stop`仅停止本脚本创建且启动时间/命令相符的进程。端口被其他进程占用时拒绝接管。已有手工启动的三端由原启动会话管理，不得误杀。运行日志和PID信息在忽略提交的`.runtime`目录。

后端需按后端README另行启动于18080；开发代理保留Origin。后端三个平台允许Origin必须与上述端口一致。前端入口独立，认证结果由后端决定，访问另一个平台路径不能切换身份。API不可用时页面显示错误，不使用模拟业务。

## 独立镜像

`docker --context colima-zhixiang compose -f deploy/compose.yaml build`分别构建三个镜像。基础镜像固定digest，依赖由package-lock固定，运行镜像不包含Node、源码或凭据。构建时PLATFORM仅接受student/admin/partner。

`docker --context colima-zhixiang compose -f deploy/compose.yaml up -d`为本机示例，入口为18780/18781/18782。必须先配置后端对应Origin；开发端口的Origin不能直接替代容器端口。默认API_UPSTREAM使用本机Colima提供的host.lima.internal:18080，其他环境须指定可达API地址。同一容器网络部署时可设为http://api:8080。此变量由可信部署管理员配置，不接受用户输入。

静态路由回退index.html，哈希资源长期缓存，入口不缓存。API代理关闭SSE缓冲，保留认证Cookie和Origin。上传文件直接走存储签名地址，不经过静态服务。服务协议地址/版本属于构建配置，应在学生构建前设置真实内容；未配置则注册不可完成。

生产应由TLS入口转发，配置对应HTTPS Origin、可信代理与安全Cookie。镜像、编排、持久化数据相互独立；本Compose不部署数据库，也不是跨主机HA。生产k3s及密钥管理沿用后端架构文档，未进行真实集群验证。

## 本轮证据与限制

管理员0.1.0-dev镜像已实际构建并运行，18781的/healthz和/admin/orders为200，/api/v1/auth/me为401，证明未登录认证拒绝。完整三端容器登录尚未验证；开发环境实际浏览器已验证管理员MFA登录及院校/专业/订单创建。frontctl已实际启动三端，并完成中介端stop/start回归，三个HTTP入口均正常；进程记录和启动时间检查已生效。不能以静态页面HTTP200认定全部业务通过。
