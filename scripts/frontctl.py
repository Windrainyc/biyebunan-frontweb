#!/usr/bin/env python3
"""管理本工程的三个Vite开发进程。仅停止本脚本记录且身份一致的进程。"""
import argparse
import fcntl
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ROOT / '.runtime'
PORTS = {'student': 18770, 'admin': 18771, 'partner': 18772}


def identity(pid):
    """用启动时间和命令确认PID未被操作系统复用。"""
    result = subprocess.run(['ps', '-p', str(pid), '-o', 'lstart=', '-o', 'command='],
                            capture_output=True, text=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else ''


def ready(port):
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=1) as response:
            return response.status == 200
    except (OSError, ValueError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'status', 'stop'])
    parser.add_argument('--platform', choices=[*PORTS, 'all'], default='all')
    args = parser.parse_args()
    RUNTIME.mkdir(mode=0o700, exist_ok=True)
    with (RUNTIME / 'lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for platform, port in PORTS.items():
            if args.platform not in ('all', platform):
                continue
            state_path = RUNTIME / f'{platform}.json'
            state = json.loads(state_path.read_text()) if state_path.exists() else {}
            alive = bool(state.get('identity')) and identity(state['pid']) == state['identity']
            if args.action == 'stop':
                if alive:
                    os.killpg(state['pid'], signal.SIGTERM)
                    for _ in range(100):
                        if identity(state['pid']) != state['identity']:
                            break
                        time.sleep(0.1)
                    else:
                        raise SystemExit(f'{platform}未在10秒内停止，保留进程记录，不强制杀死')
                    print(f'{platform}：已优雅停止')
                else:
                    print(f'{platform}：没有本脚本拥有的运行进程')
                state_path.unlink(missing_ok=True)
                continue
            if args.action == 'start' and not alive:
                with socket.socket() as probe:
                    if probe.connect_ex(('127.0.0.1', port)) == 0:
                        raise SystemExit(f'{port}已被占用，拒绝接管或停止未知进程')
                node = shutil.which('node')
                vite = ROOT / 'node_modules/vite/bin/vite.js'
                if not node or not vite.exists():
                    raise SystemExit('需要Node与npm ci安装的本工程依赖')
                with (RUNTIME / f'{platform}.log').open('ab') as log:
                    process = subprocess.Popen([node, str(vite), '--mode', platform], cwd=ROOT,
                                               stdout=log, stderr=log, start_new_session=True)
                state = {'pid': process.pid, 'identity': identity(process.pid), 'port': port}
                state_path.write_text(json.dumps(state))
                for _ in range(50):
                    if process.poll() is not None:
                        raise SystemExit(f'{platform}启动失败，查看.runtime对应日志')
                    if ready(port):
                        break
                    time.sleep(0.1)
                if not ready(port):
                    raise SystemExit(f'{platform}启动后HTTP未就绪，保留记录供检查')
                alive = process.poll() is None
            print(f'{platform}：进程{"运行" if alive else "未由本脚本启动"}，'
                  f'HTTP{"正常" if ready(port) else "不可达"}，http://127.0.0.1:{port}')


if __name__ == '__main__':
    main()
