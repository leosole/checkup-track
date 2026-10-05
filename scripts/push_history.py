#!/usr/bin/env python3
"""Commit staged/unstaged project changes and push specific branches.

Usage: python3 scripts/push_history.py "Commit message" [branch ...]

Never force-pushes; a non-fast-forward rejection aborts with an error.
Authenticates https remotes with GIT_ASKPASS + GITHUB_TOKEN (env or .env.local).
Token values are never printed.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_SCRIPT = os.path.join(ROOT, "scripts", "git-askpass.sh")

# Freebuff file writes drop the executable bit; restore it for git.
if os.path.exists(TOKEN_SCRIPT):
    os.chmod(TOKEN_SCRIPT, 0o755)


def get_token() -> str:
    tok = os.environ.get("GITHUB_TOKEN")
    if not tok:
        path = os.path.join(ROOT, ".env.local")
        try:
            with open(path, "r", encoding="utf-8") as fh:
                for line in fh:
                    if line.strip().startswith("GITHUB_TOKEN="):
                        tok = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        except OSError:
            pass
    if not tok:
        sys.exit("ERROR: token not available (env or .env.local)")
    return tok


def run(args):
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    print("$", " ".join(args))
    if r.stdout.strip():
        print(r.stdout.strip()[-600:])
    if r.returncode != 0:
        print("STDERR:", r.stderr.strip()[-600:])
        sys.exit(r.returncode)
    return r.stdout


if len(sys.argv) < 2:
    sys.exit("usage: push_history.py 'message' [branch ...]")
message = sys.argv[1]
branches = sys.argv[2:] or [
    subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=ROOT,
                   capture_output=True, text=True).stdout.strip()
]

run(["git", "add", "-A"])
staged = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode != 0
if staged:
    run(["git", "commit", "-m", message])
else:
    print("nothing to commit")

run(["git", "log", "--oneline", "-3"])

env = dict(os.environ)
env["GIT_ASKPASS"] = TOKEN_SCRIPT
env["GIT_TERMINAL_PROMPT"] = "0"
env["GH_TOKEN_VAL"] = get_token()

failed = False
for branch in branches:
    r = subprocess.run(["git", "push", "-u", "origin", branch],
                       cwd=ROOT, capture_output=True, text=True, env=env)
    print(f"$ git push -u origin {branch} -> rc={r.returncode}")
    out = (r.stdout + r.stderr).strip()
    print(out[-800:] if out else "(no output)")
    if r.returncode != 0:
        failed = True

sys.exit(1 if failed else 0)
