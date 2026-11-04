#!/usr/bin/env python3
"""GitHub REST API integration for the Freebuff sandbox.

Authenticates with GITHUB_TOKEN (env var, with in-process .env.local fallback)
and performs repo inspection, branch push (Git Data API), PR creation,
check polling, and merging. The token value is never printed.
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

API = "https://api.github.com"
REPO = "leosole/exametry"
BRANCH = "feat/health-dashboard"

# Integration tooling that lives only as untracked files locally but belongs
# in the repository.
EXTRA_FILES = {
    "scripts/github_sync.py": "100644",
    "scripts/git-askpass.sh": "100755",
}


def get_token() -> str:
    tok = os.environ.get("GITHUB_TOKEN")
    if not tok:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env.local")
        try:
            with open(path, "r", encoding="utf-8") as fh:
                for line in fh:
                    if line.strip().startswith("GITHUB_TOKEN="):
                        tok = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        except OSError:
            pass
    if not tok:
        sys.exit("ERROR: GITHUB_TOKEN not available (env or .env.local)")
    return tok


def req(method: str, path: str, body=None, raw: bool = False):
    data = None
    r = urllib.request.Request(API + path, method=method)
    r.add_header("Authorization", "token " + get_token())
    r.add_header("User-Agent", "freebuff-exametry-sync")
    r.add_header("Accept", "application/vnd.github+json")
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        r.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(r, data=data, timeout=30)
        payload = resp.read()
        return resp.status, (payload if raw else (json.loads(payload) if payload else {}))
    except urllib.error.HTTPError as e:
        payload = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(payload)
        except ValueError:
            return e.code, {"message": payload[:300]}


def local_tree(ref: str):
    """[(mode, path)] for all files tracked at a local git ref."""
    out = subprocess.run(
        ["git", "ls-tree", "-r", "-z", "--full-tree", ref],
        capture_output=True, check=True,
    ).stdout.decode("utf-8")
    entries = []
    for rec in out.split("\0"):
        if not rec:
            continue
        meta, path = rec.split("\t", 1)
        mode, _typ, _sha = meta.split()
        entries.append((mode, path))
    return entries


def create_blob(path: str) -> str:
    with open(path, "rb") as fh:
        content = base64.b64encode(fh.read()).decode("ascii")
    status, resp = req("POST", f"/repos/{REPO}/git/blobs",
                       {"content": content, "encoding": "base64"})
    if status != 201:
        sys.exit(f"ERROR blob {path}: {status} {json.dumps(resp)[:200]}")
    return resp["sha"]


def build_tree(entries, base_tree=None) -> str:
    """entries: [(mode, path, blob_sha)] flat -> create nested trees, return root sha."""
    root = {}
    for mode, path, blob in entries:
        parts = path.split("/")
        node = root
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = (mode, blob)

    def emit(node: dict, prefix: str) -> str:
        tree = []
        for name, val in sorted(node.items()):
            full = f"{prefix}/{name}" if prefix else name
            if isinstance(val, dict):
                sub = emit(val, full)
                tree.append({"path": name, "mode": "040000", "type": "tree", "sha": sub})
            else:
                mode, blob = val
                tree.append({"path": name, "mode": mode, "type": "blob", "sha": blob})
        body = {"tree": tree}
        if base_tree:
            body["base_tree"] = base_tree
        status, resp = req("POST", f"/repos/{REPO}/git/trees", body)
        if status != 201:
            sys.exit(f"ERROR tree {prefix}: {status} {json.dumps(resp)[:200]}")
        return resp["sha"]

    return emit(root, "")


def create_commit(tree_sha: str, parents, message: str) -> str:
    who = {"name": "Freebuff", "email": "noreply@freebuff.com",
           "date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    status, resp = req("POST", f"/repos/{REPO}/git/commits",
                       {"message": message, "tree": tree_sha, "parents": parents,
                        "author": who, "committer": who})
    if status != 201:
        sys.exit(f"ERROR commit: {status} {json.dumps(resp)[:200]}")
    return resp["sha"]


def upsert_ref(branch: str, sha: str):
    status, resp = req("POST", f"/repos/{REPO}/git/refs",
                       {"ref": f"refs/heads/{branch}", "sha": sha})
    if status == 201:
        print(f"created ref {branch} -> {sha}")
        return
    status, resp = req("PATCH", f"/repos/{REPO}/git/refs/heads/{branch}", {"sha": sha, "force": True})
    if status != 200:
        sys.exit(f"ERROR ref {branch}: {status} {json.dumps(resp)[:200]}")
    print(f"updated ref {branch} -> {sha}")


def push_branch(ref: str, message: str, parents, extra_files=None) -> str:
    entries = [(mode, path) for mode, path in local_tree(ref)]
    for path, mode in (extra_files or {}).items():
        if not any(p == path for _m, p in entries):
            entries.append((mode, path))
    print(f"preparing {ref}: {len(entries)} files")
    blobbed = []
    for mode, path in entries:
        blobbed.append((mode, path, create_blob(path)))
    root = build_tree(blobbed)
    sha = create_commit(root, parents, message)
    print(f"commit {sha} (tree {root})")
    return sha


def bootstrap_contents_api() -> str:
    """Initialize an empty repo with a throwaway commit (Git Data API needs >=1 commit)."""
    content = base64.b64encode(b"# exametry\n\nBootstrap commit; replaced by real history.\n").decode()
    status, resp = req("PUT", f"/repos/{REPO}/contents/.freebuff-bootstrap.md",
                       {"message": "Initialize repository", "content": content})
    if status == 201:
        print("bootstrap commit created on default branch")
        return resp["commit"]["sha"]
    if status == 422:
        print("bootstrap file already present; repo not empty")
        return None
    sys.exit(f"ERROR bootstrap: {status} {json.dumps(resp)[:200]}")


def cmd_whoami():
    status, me = req("GET", "/user")
    if status != 200:
        sys.exit(f"ERROR /user: {status} {json.dumps(me)[:200]}")
    print("token valid, login:", me.get("login"))
    status, repo = req("GET", f"/repos/{REPO}")
    if status == 200:
        print(f"repo: {repo['full_name']} private={repo['private']} "
              f"default_branch={repo['default_branch']} size={repo['size']}KB "
              f"pushed_at={repo.get('pushed_at')}")
        status, refs = req("GET", f"/repos/{REPO}/git/refs/heads")
        if status == 200 and refs:
            print("branches:", ", ".join(r["ref"].removeprefix("refs/heads/") for r in refs))
        else:
            print("branches: none (empty repo)")
    elif status == 404:
        print("repo: NOT FOUND (create it before pushing)")
    else:
        sys.exit(f"ERROR repo: {status} {json.dumps(repo)[:200]}")


def cmd_push():
    status, repo = req("GET", f"/repos/{REPO}")
    if status == 404:
        status, repo = req("POST", "/user/repos", {"name": "exametry", "private": True})
        if status != 201:
            sys.exit(f"ERROR create repo: {status} {json.dumps(repo)[:200]}")
        print("created repo", repo["full_name"])
    default = repo["default_branch"]
    status, refs = req("GET", f"/repos/{REPO}/git/refs/heads")
    empty = status != 200 or not refs

    bootstrap_sha = None
    if empty:
        print("repo is empty: bootstrapping via Contents API")
        bootstrap_sha = bootstrap_contents_api()
    if bootstrap_sha is None:
        status, r = req("GET", f"/repos/{REPO}/git/ref/heads/{default}")
        bootstrap_sha = r["object"]["sha"] if status == 200 else None

    # master baseline rebuilt exactly from local master (9a0a51e = empty tree)
    if not local_tree("master"):
        EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
        parents = [bootstrap_sha] if bootstrap_sha else []
        master_sha = create_commit(EMPTY_TREE, parents, "Initial commit")
        print(f"master commit {master_sha} (empty tree, parent bootstrap)")
    else:
        master_sha = push_branch("master", "Initial commit", [])
    upsert_ref("master", master_sha)

    if default != "master" and empty:
        status, _ = req("PATCH", f"/repos/{REPO}", {"default_branch": "master"})
        print("default branch ->", "master" if status == 200 else f"(PATCH failed {status})")
        status, _ = req("DELETE", f"/repos/{REPO}/git/refs/heads/{default}")
        print(f"removed bootstrap branch {default}: {status}")

    status, r = req("GET", f"/repos/{REPO}/git/ref/heads/master")
    base_head = r["object"]["sha"]
    feat_sha = push_branch(BRANCH,
                           "Add health dashboard monorepo: FastAPI backend + React frontend",
                           [base_head], extra_files=EXTRA_FILES)
    upsert_ref(BRANCH, feat_sha)
    print("push complete")


def cmd_pr():
    status, refs = req("GET", f"/repos/{REPO}/git/refs/heads")
    heads = {r["ref"].removeprefix("refs/heads/"): r["object"]["sha"] for r in refs}
    if BRANCH not in heads:
        sys.exit(f"ERROR: {BRANCH} not on remote")
    base = "master" if "master" in heads else next(iter(heads))
    status, pulls = req("GET", f"/repos/{REPO}/pulls?head=leosole:{BRANCH}&state=open")
    if status == 200 and pulls:
        print("PR already open:", pulls[0]["html_url"], "#", pulls[0]["number"])
        return
    title = "Add AGENTS.md with project instructions for coding agents"
    body = (
        "## Summary\n"
        "- New `AGENTS.md` at the repo root describing what exametry is and how to work on it safely: the PDF -> Markdown -> Groq extraction pipeline, the two-process layout (FastAPI on 8000, Vite on 5173), and a one-line purpose per meaningful file\n"
        "- Documents the conventions that are easy to break: flat backend imports and why `api/index.py` manipulates `sys.path`, the adapter being a shim rather than a second app, schema created with `create_all` and no migrations, keeping SQLite and Postgres paths both working, B2-vs-local storage parity, and server-side Google ID-token verification\n"
        "- Captures frontend rules: no router (auth-state switch in `app.tsx`), lowercase-hyphen filenames, reuse of `components/ui` primitives and the existing Tailwind tokens, and HMR disabled in `vite.config.ts` on purpose\n"
        "- Environment table for `GROQ_API_KEY`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `DATABASE_URL`, `B2_*` including how the app degrades when each is missing, and the reminder that GitHub Actions secrets never reach the running app\n"
        "- API map, a concrete verification recipe (import/schema check, typecheck, endpoint smoke against a throwaway DB, `freebuff-deploy check`), and known constraints (hosting body limits below the app's 25 MB guard, non-deterministic LLM extraction)\n"
        "\n## Test plan\n"
        "- Every statement checked against the source: `models.py`, `main.py`, `auth.py`, `api-client.ts`, `auth-context.tsx`, `vite.config.ts`, the CI workflow and `scripts/preview.sh`\n"
        "- Documentation-only change; CI should be unaffected"
    )
    status, pr = req("POST", f"/repos/{REPO}/pulls",
                     {"title": title, "body": body, "head": BRANCH, "base": base})
    if status != 201:
        sys.exit(f"ERROR create PR: {status} {json.dumps(pr)[:300]}")
    print(f"PR #{pr['number']} opened: {pr['html_url']}")


def cmd_checks():
    status, prs = req("GET", f"/repos/{REPO}/pulls?head=leosole:{BRANCH}&state=open")
    if status != 200 or not prs:
        status, prs = req("GET", f"/repos/{REPO}/pulls?state=all")
    pr = prs[0]
    sha = pr["head"]["sha"]
    status, runs = req("GET", f"/repos/{REPO}/commits/{sha}/check-runs")
    runs = runs.get("check_runs", []) if status == 200 else []
    status, actions = req("GET", f"/repos/{REPO}/actions/runs?head_sha={sha}")
    aruns = actions.get("workflow_runs", []) if status == 200 else []
    if not runs and not aruns:
        print("NO-CHECKS-YET sha=", sha[:8])
        return
    done, ok = True, True
    for r in runs:
        print(f"check {r['name']}: {r['status']} {r.get('conclusion') or ''}")
        if r["status"] != "completed":
            done = False
        elif r.get("conclusion") not in ("success", "skipped"):
            ok = False
    for a in aruns:
        print(f"workflow {a['name']}: {a['status']} {a.get('conclusion') or ''}")
        if a["status"] not in ("completed",):
            done = False
        elif a.get("conclusion") not in ("success", "skipped", None):
            ok = False
    print("STATE:", "GREEN" if done and ok else ("PENDING" if not done else "FAILED"))


def cmd_merge():
    status, prs = req("GET", f"/repos/{REPO}/pulls?head=leosole:{BRANCH}&state=open")
    if status != 200 or not prs:
        sys.exit("ERROR: no open PR found")
    num = prs[0]["number"]
    status, merged = req("PUT", f"/repos/{REPO}/pulls/{num}/merge",
                         {"merge_method": "merge"})
    if status == 200:
        print(f"PR #{num} MERGED: {merged.get('sha')}")
    else:
        sys.exit(f"ERROR merge: {status} {json.dumps(merged)[:300]}")
    status, pr = req("GET", f"/repos/{REPO}/pulls/{num}")
    print("verified state:", pr.get("state"), "merged:", pr.get("merged"))


def cmd_finalize():
    """After force-push: make master the default branch and drop the bootstrap branch."""
    status, repo = req("GET", f"/repos/{REPO}")
    default = repo.get("default_branch")
    print("current default:", default)
    if default != "master":
        status, _ = req("PATCH", f"/repos/{REPO}", {"default_branch": "master"})
        print("default branch -> master:", status)
        if default:
            status, _ = req("DELETE", f"/repos/{REPO}/git/refs/heads/{default}")
            print(f"removed bootstrap branch {default}:", status)
    status, refs = req("GET", f"/repos/{REPO}/git/refs/heads")
    if status == 200:
        print("branches:", ", ".join(r["ref"].removeprefix("refs/heads/") for r in refs))
    cmd_whoami()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "whoami"
    {"whoami": cmd_whoami, "push": cmd_push, "pr": cmd_pr,
     "checks": cmd_checks, "merge": cmd_merge, "finalize": cmd_finalize}[cmd]()
