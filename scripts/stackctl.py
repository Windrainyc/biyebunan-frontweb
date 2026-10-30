#!/usr/bin/env python3
"""一键管理已有隔离验证环境：三端容器、API、专用worker；不创建/删除数据库或数据卷。"""
import argparse
import fcntl
import json
import os
from pathlib import Path
import signal
import shlex
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT.parent / '知项平台后端'
RUNTIME = ROOT / '.runtime/stack'
DOCKER = ['docker', '--context', 'colima-zhixiang', 'compose', '-p', 'zhixiang-ui', '-f', str(ROOT / 'deploy/compose.yaml')]


def identity(pid):
    # macOS Python启动器会exec到Python.app；固定启动时间与脚本参数，忽略解释器路径变化。
    started = subprocess.run(['ps', '-p', str(pid), '-o', 'lstart='], capture_output=True, text=True)
    command = subprocess.run(['ps', '-p', str(pid), '-o', 'command='], capture_output=True, text=True)
    if started.returncode or command.returncode:
        return ''
    args = shlex.split(command.stdout.strip())
    return started.stdout.strip() + ' ' + shlex.join(args[1:]) if len(args) > 1 else ''


def healthy(url):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return response.status == 200
    except OSError:
        return False


def stop_process(name, state):
    item = state.get(name)
    if not item or identity(item['pid']) != item['identity']:
        return
    os.killpg(item['pid'], signal.SIGINT)
    for _ in range(350):
        if identity(item['pid']) != item['identity']:
            return
        time.sleep(.1)
    raise RuntimeError(f'{name}未在35秒内优雅退出，保留记录，不强制终止')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'stop', 'status'])
    parser.add_argument('--fixtures', action='store_true', help='显式开启本机HTTPS短信/模型协议夹具，禁止用于生产')
    parser.add_argument('--office', action='store_true', help='启动独立kkFileView Office转换容器并接入私有预览')
    parser.add_argument('--video', action='store_true', help='显式启用宿主FFmpeg视频处理，须已安装ffmpeg和ffprobe')
    parser.add_argument('--build', action='store_true', help='启动前重新构建三个前端镜像')
    args = parser.parse_args()
    os.umask(0o077)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    state_file = RUNTIME / 'state.json'
    with (RUNTIME / 'lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = json.loads(state_file.read_text()) if state_file.exists() else {}
        if args.action == 'status':
            for name in ['api', 'worker', 'model']:
                item = state.get(name)
                print(name + '：' + ('本脚本进程运行' if item and identity(item['pid']) == item['identity'] else '未运行或非本脚本管理'))
            for port in [18080, 18780, 18781, 18782]:
                path = '/actuator/health/readiness' if port == 18080 else '/healthz'
                print(f'{port}：' + ('HTTP正常' if healthy(f'http://127.0.0.1:{port}{path}') else '不可达'))
            return
        if args.action == 'stop':
            for name in ['worker', 'api', 'model']:
                stop_process(name, state)
            # 仅停止固定项目，不删除容器、网络或持久化卷。
            subprocess.run(DOCKER + ['stop'], check=True)
            if state.get('office'):
                subprocess.run(['docker', '--context', 'colima-zhixiang', 'compose', '-p', 'zhixiang-office', '-f', str(BACKEND / 'deploy/kkfileview/compose.yaml'), 'stop'], check=True)
            state_file.unlink(missing_ok=True)
            print('已停止本脚本管理的进程和知项三端容器，数据保持不变。')
            return
        if any(identity(item['pid']) == item['identity'] for item in state.values() if isinstance(item, dict) and 'pid' in item):
            raise RuntimeError('已有受管进程，请先status检查，拒绝重复启动')
        verification = json.loads((BACKEND / 'docs/ui-verification-state.json').read_text())
        if not verification.get('isolatedDatabase') or not verification['database'].startswith('zx_ui_'):
            raise RuntimeError('要求已准备的隔离UI验证库；不会自动创建或改用业务库')
        for port in [18080, 18443, 18444] if args.fixtures else [18080]:
            with socket.socket() as probe:
                if probe.connect_ex(('127.0.0.1', port)) == 0:
                    raise RuntimeError(f'{port}被占用，拒绝接管或停止外部进程')
        # 本机协议夹具固定使用非商业测试说明，与隔离API版本一致；不写入生产默认配置。
        if args.build or args.fixtures:
            build_env = os.environ.copy()
            if args.fixtures:
                build_env.update(VITE_TERMS_URL='http://127.0.0.1:18780/local-test-terms.html',
                                 VITE_TERMS_VERSION='ui-test-nonbinding')
            subprocess.run(DOCKER + ['build'], check=True, env=build_env)
        state = {}

        def launch(name, script, options):
            with (RUNTIME / f'{name}.log').open('ab') as log:
                proc = subprocess.Popen([sys.executable, str(BACKEND / 'scripts' / script), *options], cwd=BACKEND, stdout=log, stderr=log, start_new_session=True)
            state[name] = {'pid': proc.pid, 'identity': identity(proc.pid)}
            state_file.write_text(json.dumps(state, ensure_ascii=False, indent=2))
            return proc

        try:
            if args.fixtures:
                launch('model', 'start-ui-model.py', [])
            if args.office:
                subprocess.run([sys.executable, str(BACKEND / 'scripts/start-office-preview.py')], check=True)
                state['office'] = True
                state_file.write_text(json.dumps(state, ensure_ascii=False, indent=2))
            options = ['--resume', '--container-frontends'] + (['--office'] if args.office else []) + (['--test-sms', '--test-model'] if args.fixtures else [])
            api = launch('api', 'start-ui-verification.py', options)
            for _ in range(90):
                if api.poll() is not None:
                    raise RuntimeError('API启动失败，检查.runtime/stack/api.log')
                if healthy('http://127.0.0.1:18080/actuator/health/readiness'):
                    break
                time.sleep(1)
            else:
                raise RuntimeError('API未在90秒内就绪')
            worker_options = (['--test-model'] if args.fixtures else []) + (['--video'] if args.video else [])
            worker = launch('worker', 'start-ui-worker.py', worker_options)
            # worker无HTTP端口，确认启动日志，不能以进程存在冒充就绪。
            directory = Path(verification['credentialFile']).parent
            for _ in range(60):
                if worker.poll() is not None:
                    raise RuntimeError('worker启动失败，检查受保护日志')
                recorded = directory / 'worker-state.json'
                if recorded.exists():
                    current = json.loads(recorded.read_text())
                    if identity(current['pid']) and 'Started PlatformApplication' in (directory / 'worker.log').read_text():
                        break
                time.sleep(1)
            else:
                raise RuntimeError('worker未在60秒内启动')
            subprocess.run(DOCKER + ['up', '-d'], check=True)
            for port in [18780, 18781, 18782]:
                for _ in range(30):
                    if healthy(f'http://127.0.0.1:{port}/healthz'):
                        break
                    time.sleep(1)
                else:
                    raise RuntimeError(f'{port}前端未就绪')
            print('隔离环境已就绪：学生18780、管理员18781、中介18782；API18080。')
            print('本机协议夹具已显式启用，非真实供应商。' if args.fixtures else '外部短信和模型调用保持关闭。')
        except Exception:
            for name in ['worker', 'api', 'model']:
                stop_process(name, state)
            raise


if __name__ == '__main__':
    main()
