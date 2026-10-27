#!/usr/bin/env python3
"""从后端已验证契约生成只读前端表单/权限元数据，不生成伪接口。
需要PyYAML，可使用架构设计目录tools/.venv/bin/python运行。
"""
import json
from pathlib import Path
import yaml
root=Path(__file__).resolve().parents[1]
source=root.parent/'知项平台后端/contract/openapi.yaml'
doc=yaml.safe_load(source.read_text())
operations={}
for path,methods in doc['paths'].items():
    for method,spec in methods.items():
        if method not in ('get','post','put','patch','delete'):continue
        successful=next((v for k,v in spec['responses'].items() if str(k).startswith('2')), {})
        operations[method.upper()+' '+path.removeprefix('/api/v1')]={'operationId':spec['operationId'],'summary':spec['summary'],'permission':spec.get('x-permission'),'body':spec.get('requestBody',{}).get('content',{}).get('application/json',{}).get('schema'),'parameters':spec.get('parameters',[]),'response':successful.get('content',{}).get('application/json',{}).get('schema')}
(root/'src/config/contract.json').write_text(json.dumps({'version':doc['info']['version'],'schemas':doc['components']['schemas'],'operations':operations},ensure_ascii=False,indent=2)+'\n')
print('已生成',len(operations),'项契约元数据')
