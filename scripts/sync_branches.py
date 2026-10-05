#!/usr/bin/env python3
"""Fetch origin and fast-forward local branches after a remote merge.

Uses the askpass helper (GITHUB_TOKEN from env or .env.local, never printed).
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_SCRIPT = os.path.join(ROOT, "scripts", "git-askpass.sh")
if os.path.exists(TOKEN_SCRIPT):
    os.chmod(TOKEN_SCRIPT, 0o755)

tok = os.environ.get("GITHUB_TOKEN")
if not tok:
    try:
        with open(os.path.join(ROOT, ".env.local"), "r", encoding="utf-8") as fh:
            for line in fh:
                if line.strip().startswith("GITHUB_TOKEN="):
                    tok = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    except OSError:
        pass
if not tok:
    sys.exit("ERROR: token not available (env or .env.local)")

env = dict(os.environ)
env["GIT_ASKPASS"] = TOKEN_SCRIPT
env["GIT_TERMINAL_PROMPT"] = "0"
env["GH_TOKEN_VAL"] = tok


def run(args):
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, env=env)
    print("$", " ".join(args))
    print(r.stdout.strip()[-400:])
    if r.returncode != 0:
        print("STDERR:", r.stderr.strip()[-300:])
        sys.exit(r.returncode)


run(["git", "fetch", "origin"])
run(["git", "checkout", "master"])
run(["git", "merge", "--ff-only", "origin/master"])
run(["git", "log", "--oneline", "-3"])
run(["git", "checkout", "feat/health-dashboard"])
run(["git", "merge", "--ff-only", "origin/feat/health-dashboard"])
run(["git", "status", "-sb"])
print("branches synced")
