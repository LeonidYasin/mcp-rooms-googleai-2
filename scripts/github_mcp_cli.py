#!/usr/bin/env python3
"""
GitHub & MCP CLI Helper Script.
Provides tools to manage Pull Requests, Issues, Branches, and Workflows on GitHub without hardcoded credentials.
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error

def github_request(endpoint: str, method: str = "GET", data: dict = None, token: str = None):
    """
    Perform an HTTP request to the GitHub REST API.
    """
    if not token:
        print("Error: GitHub Token is required. Set GITHUB_TOKEN environment variable or pass --token.", file=sys.stderr)
        sys.exit(1)

    url = f"https://api.github.com{endpoint}" if endpoint.startswith("/") else endpoint
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GitHub-MCP-CLI/1.0"
    }

    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            if response.status in (200, 201, 204):
                res_body = response.read().decode("utf-8")
                return json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}", file=sys.stderr)
        try:
            error_details = json.loads(e.read().decode("utf-8"))
            print(f"Message: {error_details.get('message', '')}", file=sys.stderr)
        except Exception:
            pass
        sys.exit(1)
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        sys.exit(1)

# --- PR Handlers ---
def handle_prs(args, token):
    owner, repo = args.repo.split("/", 1)
    if args.action == "list":
        state = args.state or "all"
        prs = github_request(f"/repos/{owner}/{repo}/pulls?state={state}&per_page=100", token=token)
        print(f"=== PULL REQUESTS ({owner}/{repo} - state: {state}) ===")
        for pr in prs:
            status = "OPEN" if pr["state"] == "open" else ("MERGED" if pr.get("merged_at") else "CLOSED")
            print(f"#{pr['number']} [{status}] {pr['title']} (by @{pr['user']['login']})")
            print(f"  URL: {pr['html_url']}")
            print(f"  Branch: {pr['head']['ref']} -> {pr['base']['ref']}\n")
    elif args.action == "get":
        if not args.number:
            print("Error: --number is required for 'get' action", file=sys.stderr)
            sys.exit(1)
        pr = github_request(f"/repos/{owner}/{repo}/pulls/{args.number}", token=token)
        print(json.dumps(pr, indent=2))
    elif args.action == "create":
        if not args.title or not args.head or not args.base:
            print("Error: --title, --head, and --base are required for 'create' action", file=sys.stderr)
            sys.exit(1)
        payload = {"title": args.title, "head": args.head, "base": args.base, "body": args.body or ""}
        pr = github_request(f"/repos/{owner}/{repo}/pulls", method="POST", data=payload, token=token)
        print(f"Successfully created PR #{pr['number']}: {pr['html_url']}")
    elif args.action == "merge":
        if not args.number:
            print("Error: --number is required for 'merge' action", file=sys.stderr)
            sys.exit(1)
        res = github_request(f"/repos/{owner}/{repo}/pulls/{args.number}/merge", method="PUT", token=token)
        print(f"PR #{args.number} merged: {res.get('message', 'Success')}")

# --- Issues Handlers ---
def handle_issues(args, token):
    owner, repo = args.repo.split("/", 1)
    if args.action == "list":
        state = args.state or "all"
        issues = github_request(f"/repos/{owner}/{repo}/issues?state={state}&per_page=100", token=token)
        print(f"=== ISSUES ({owner}/{repo} - state: {state}) ===")
        for issue in issues:
            if "pull_request" in issue:
                continue  # Skip PRs listed under issues API
            print(f"#{issue['number']} [{issue['state'].upper()}] {issue['title']} (by @{issue['user']['login']})")
            print(f"  URL: {issue['html_url']}\n")
    elif args.action == "create":
        if not args.title:
            print("Error: --title is required for 'create' action", file=sys.stderr)
            sys.exit(1)
        payload = {"title": args.title, "body": args.body or ""}
        issue = github_request(f"/repos/{owner}/{repo}/issues", method="POST", data=payload, token=token)
        print(f"Successfully created Issue #{issue['number']}: {issue['html_url']}")
    elif args.action == "close":
        if not args.number:
            print("Error: --number is required for 'close' action", file=sys.stderr)
            sys.exit(1)
        payload = {"state": "closed"}
        issue = github_request(f"/repos/{owner}/{repo}/issues/{args.number}", method="PATCH", data=payload, token=token)
        print(f"Closed Issue #{issue['number']}")

# --- Branches Handlers ---
def handle_branches(args, token):
    owner, repo = args.repo.split("/", 1)
    if args.action == "list":
        branches = github_request(f"/repos/{owner}/{repo}/branches?per_page=100", token=token)
        print(f"=== BRANCHES ({owner}/{repo}) ===")
        for branch in branches:
            print(f"- {branch['name']} (commit: {branch['commit']['sha'][:7]})")
    elif args.action == "create":
        if not args.name or not args.from_sha:
            print("Error: --name and --from-sha are required for branch creation", file=sys.stderr)
            sys.exit(1)
        payload = {"ref": f"refs/heads/{args.name}", "sha": args.from_sha}
        res = github_request(f"/repos/{owner}/{repo}/git/refs", method="POST", data=payload, token=token)
        print(f"Successfully created branch '{args.name}'")
    elif args.action == "delete":
        if not args.name:
            print("Error: --name is required for branch deletion", file=sys.stderr)
            sys.exit(1)
        github_request(f"/repos/{owner}/{repo}/git/refs/heads/{args.name}", method="DELETE", token=token)
        print(f"Deleted branch '{args.name}'")

# --- Workflows Handlers ---
def handle_workflows(args, token):
    owner, repo = args.repo.split("/", 1)
    if args.action == "list":
        runs = github_request(f"/repos/{owner}/{repo}/actions/runs?per_page=20", token=token)
        print(f"=== WORKFLOW RUNS ({owner}/{repo}) ===")
        for run in runs.get("workflow_runs", []):
            print(f"Run #{run['id']} [{run['status']}/{run['conclusion']}] - {run['name']} ({run['head_branch']})")
            print(f"  URL: {run['html_url']}\n")
    elif args.action == "dispatch":
        if not args.workflow_id or not args.ref:
            print("Error: --workflow-id and --ref are required for workflow dispatch", file=sys.stderr)
            sys.exit(1)
        payload = {"ref": args.ref}
        github_request(f"/repos/{owner}/{repo}/actions/workflows/{args.workflow_id}/dispatches", method="POST", data=payload, token=token)
        print(f"Dispatched workflow '{args.workflow_id}' on ref '{args.ref}'")

def main():
    parser = argparse.ArgumentParser(description="GitHub & MCP CLI Helper Script")
    parser.add_argument("--token", default=os.getenv("GITHUB_TOKEN"), help="GitHub Access Token (or set GITHUB_TOKEN env var)")
    parser.add_argument("--repo", required=True, help="Repository in 'owner/repo' format")

    subparsers = parser.add_subparsers(dest="resource", required=True, help="GitHub resource to interact with")

    # PR Subparser
    pr_parser = subparsers.add_parser("prs", help="Manage Pull Requests")
    pr_parser.add_argument("action", choices=["list", "get", "create", "merge"])
    pr_parser.add_argument("--state", choices=["open", "closed", "all"], default="all")
    pr_parser.add_argument("--number", type=int, help="PR number")
    pr_parser.add_argument("--title", help="PR title")
    pr_parser.add_argument("--head", help="Head branch")
    pr_parser.add_argument("--base", help="Base branch")
    pr_parser.add_argument("--body", help="PR body/description")

    # Issues Subparser
    issue_parser = subparsers.add_parser("issues", help="Manage Issues")
    issue_parser.add_argument("action", choices=["list", "create", "close"])
    issue_parser.add_argument("--state", choices=["open", "closed", "all"], default="all")
    issue_parser.add_argument("--number", type=int, help="Issue number")
    issue_parser.add_argument("--title", help="Issue title")
    issue_parser.add_argument("--body", help="Issue body/description")

    # Branches Subparser
    branch_parser = subparsers.add_parser("branches", help="Manage Branches")
    branch_parser.add_argument("action", choices=["list", "create", "delete"])
    branch_parser.add_argument("--name", help="Branch name")
    branch_parser.add_argument("--from-sha", help="Source commit SHA for creation")

    # Workflows Subparser
    wf_parser = subparsers.add_parser("workflows", help="Manage GitHub Workflows")
    wf_parser.add_argument("action", choices=["list", "dispatch"])
    wf_parser.add_argument("--workflow-id", help="Workflow ID or filename")
    wf_parser.add_argument("--ref", help="Git reference (branch/tag)")

    args = parser.parse_args()

    token = args.token
    if not token:
        print("Error: GitHub Access Token missing! Pass --token or set GITHUB_TOKEN environment variable.", file=sys.stderr)
        sys.exit(1)

    if args.resource == "prs":
        handle_prs(args, token)
    elif args.resource == "issues":
        handle_issues(args, token)
    elif args.resource == "branches":
        handle_branches(args, token)
    elif args.resource == "workflows":
        handle_workflows(args, token)

if __name__ == "__main__":
    main()
