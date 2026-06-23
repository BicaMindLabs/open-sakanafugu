#!/usr/bin/env python3
"""fleet-launch.py — pty.fork fallback launcher (used when detached tmux fails)

usage: fleet-launch.py <project-dir> <cmd> [args...]
  Inside <project-dir>, after stripping all CLAUDE_CODE_* env vars, start <cmd> with a pty and detach
  (caller returns immediately, ccb keeps running in the background).

Why this way:
  - strip CLAUDE_CODE_*: parent session's OAuth/session env leaks to child cc-* → fake 401.
  - pty.fork: ccb needs a tty before it will start the agent pane.
  - fork + setsid: detach from the calling shell's session, ccb survives after the caller exits.
  - drain pty: prevent ccb from blocking when the output buffer fills up.
"""
import os
import pty
import sys


def main() -> int:
    if len(sys.argv) < 3:
        sys.stderr.write("usage: fleet-launch.py <project-dir> <cmd> [args...]\n")
        return 2
    project = sys.argv[1]
    cmd = sys.argv[2:]
    if not os.path.isdir(project):
        sys.stderr.write("fleet-launch: no directory %s\n" % project)
        return 2

    # 1) strip CLAUDE_CODE_* (keep provider key/PATH/HOME etc.)
    for k in [k for k in list(os.environ) if k.startswith("CLAUDE_CODE")]:
        del os.environ[k]

    # 2) daemonize: parent returns immediately; child detaches from the tty session
    if os.fork() > 0:
        return 0
    os.chdir(project)
    os.setsid()

    # 3) pty.fork: grandchild exec's the target command inside the pty
    pid, fd = pty.fork()
    if pid == 0:
        try:
            os.execvp(cmd[0], cmd)
        except OSError as e:
            sys.stderr.write("exec %s failed: %s\n" % (cmd[0], e))
            os._exit(127)

    # 4) daemon drains pty output, ends when target exits
    try:
        while True:
            try:
                if not os.read(fd, 4096):
                    break
            except OSError:
                break
    finally:
        os._exit(0)


if __name__ == "__main__":
    sys.exit(main())
