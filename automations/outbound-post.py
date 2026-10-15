#!/usr/bin/env python3
"""POST a JSON file to one of Flagship Insights' outbound agent endpoints.

Usage: python3 automations/outbound-post.py <endpoint> <json-file> [out-file]
  endpoint: ingest | audit-queue | audits | replies

The shared secret comes from $OUTBOUND_SYNC_SECRET or the gitignored .outbound-sync-secret file
at the repo root, so it never appears in a command line or in output. The response body is
printed (or written to out-file), and the exit code is non-zero on any HTTP error.
"""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = "https://flagship-insights-ai.netlify.app/api/outbound/"
ENDPOINTS = {"ingest", "audit-queue", "audits", "replies"}


def main() -> int:
    if len(sys.argv) not in (3, 4) or sys.argv[1] not in ENDPOINTS:
        print(__doc__, file=sys.stderr)
        return 2
    secret = os.environ.get("OUTBOUND_SYNC_SECRET", "").strip()
    if not secret:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".outbound-sync-secret")
        try:
            with open(path) as f:
                secret = f.read().strip()
        except OSError:
            print("No secret: set OUTBOUND_SYNC_SECRET or write it to .outbound-sync-secret", file=sys.stderr)
            return 2
    with open(sys.argv[2], "rb") as f:
        body = f.read()
    json.loads(body)  # fail fast on malformed JSON
    req = urllib.request.Request(
        BASE + sys.argv[1],
        data=body,
        method="POST",
        headers={"Authorization": "Bearer " + secret, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            status, text = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read().decode()
    if len(sys.argv) == 4:
        with open(sys.argv[3], "w") as f:
            f.write(text)
        print(f"HTTP {status}, response written to {sys.argv[3]}")
    else:
        print(f"HTTP {status}")
        print(text)
    return 0 if status < 400 else 1


if __name__ == "__main__":
    sys.exit(main())
