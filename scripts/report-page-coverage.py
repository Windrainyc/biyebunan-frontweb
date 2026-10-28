#!/usr/bin/env python3
"""生成接口到前端承接模块的清单；映射不是每个动作都已端到端验收的证明。"""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
contract = json.loads((root/'src/config/contract.json').read_text())
common = {'schools','majors','roles','menus','models','model-prices','storages','domains','categories','tags','forum-boards','notification-templates','model-keys','users','orders','projects','knowledge','posts','reports','adjudications','audits','students','permissions'}
def owner(method, path):
    parts = path.strip('/').split('/')
    platform, name = parts[:2]
    if platform in ('health','callbacks'): return '后端运行探针/供应商回调（不属于浏览器操作）'
    if platform == 'auth':
        if name == 'navigation': return 'src/api/navigation.ts'
        if name in ('me','permissions') or parts[-1] in ('refresh','logout'): return 'src/api/client.ts'
        if parts[-1] == 'login': return 'src/views/LoginView.vue'
        return 'src/views/AccountEntryView.vue'
    if name == 'partner-invitations': return 'src/components/PartnerInvitation.vue'
    if name == 'me': return 'src/views/ProfileView.vue'
    if name in ('membership','quota'): return 'src/views/ProfileView.vue'
    if name in ('membership-plans','memberships') or (name == 'users' and 'memberships' in parts):
        return 'src/components/MembershipDetail.vue + src/views/ResourceView.vue'
    if name == 'users' and parts[-1] == 'invitations': return 'src/components/InvitationDetail.vue'
    if name == 'dictionaries': return 'src/components/ReferenceField.vue'
    if name == 'order-bindings' or (name == 'orders' and parts[-1] == 'binding-challenges'): return 'src/views/OrderBindingView.vue'
    if name == 'orders' and parts[-1] in ('receipt','assignment'): return 'src/components/OrderDetail.vue'
    if name in ('milestones','deliveries') or (name == 'projects' and parts[-1] in ('milestones','deliveries')): return 'src/components/ProjectDetail.vue'
    if name in ('uploads','assets'): return 'src/components/AssetUpload.vue + ProjectDetail/ForumDetail/KnowledgeDetail'
    if name == 'knowledge-search': return 'src/views/KnowledgeSearchView.vue'
    if name == 'knowledge': return 'src/components/KnowledgeDetail.vue + src/views/ResourceView.vue'
    if name == 'conversations': return 'src/views/ChatAuditView.vue' if platform == 'admin' else 'src/views/ChatView.vue'
    if name == 'runs': return 'src/components/UsageDetail.vue' if platform == 'admin' else 'src/views/ChatView.vue'
    if name == 'models' and platform == 'student': return 'src/views/ChatView.vue'
    if name in ('usage','usage-adjustments'): return 'src/components/UsageDetail.vue + src/views/ResourceView.vue'
    if name == 'comments' or (name == 'posts' and parts[-1] in ('comments','assets')): return 'src/components/ForumDetail.vue'
    if name == 'statistics': return 'src/views/StatisticsView.vue + DashboardView.vue'
    if name == 'notifications': return 'src/views/NotificationsView.vue'
    if name == 'exports' or (name == 'jobs' and platform == 'partner'): return 'src/views/ExportView.vue'
    if name == 'jobs': return 'src/views/ResourceView.vue + src/views/ExportView.vue'
    if name in common: return 'src/views/ResourceView.vue + src/components/RecordActions.vue'
    raise ValueError('未登记承接模块: '+method+' '+path)
rows=[]
for key in contract['operations']:
    method,path=key.split(' ',1)
    rows.append((key,owner(method,path)))
text='''# 接口到页面承接矩阵

由 `python3 scripts/report-page-coverage.py` 从当前契约生成。共 %d 个接口操作。

此表是源码承接位置索引，不代表逐接口浏览器测试通过。通用CRUD由ResourceView按契约生成字段和PUT/PATCH方法；状态动作由RecordActions生成。后端独立鉴权、幂等和CAS仍为最终约束。

实际浏览器证据见订单项目验收浏览器记录.md、论坛与取消浏览器验证.md及reports；单元测试和后端集成测试不能替代页面验收。生产供应商和集群不在本地验证结论内。

| 接口 | 承接模块 |
|---|---|
'''%len(rows)
text+=''.join('| `'+key+'` | '+source+' |\n' for key,source in rows)
(root/'docs/接口页面覆盖矩阵.md').write_text(text)
print('生成接口承接矩阵：'+str(len(rows))+'项（非端到端通过率）')
