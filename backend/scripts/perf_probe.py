"""Ad-hoc latency probe for the deployed API. Prints p50/p95/p99 per endpoint.

Run: python scripts/perf_probe.py            (warm)
     python scripts/perf_probe.py --reps 5   (more samples)
Not part of the app.
"""

from __future__ import annotations

import argparse
import statistics
import time
import urllib.request

BASE = "https://ganga-flood-api-714160101954.asia-south1.run.app/api"

ENDPOINTS = [
    "/pilots",
    "/top-risk?limit=6",
    "/alerts",
    "/impact",
    "/risk?pilot=patna",
    "/forecast?pilot=patna",
    "/agri-loss-summary",
    "/zones?pilot=patna",
]


def timed(url: str, timeout: int = 120) -> tuple[float, int, int]:
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            body = r.read()
            return (time.perf_counter() - start) * 1000, r.status, len(body)
    except Exception as e:  # noqa: BLE001
        return (time.perf_counter() - start) * 1000, -1, 0


def pct(xs: list[float], p: float) -> float:
    if not xs:
        return 0.0
    xs = sorted(xs)
    k = max(0, min(len(xs) - 1, int(round((p / 100) * (len(xs) - 1)))))
    return xs[k]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reps", type=int, default=3)
    args = ap.parse_args()

    print(f"{'endpoint':<26} {'p50ms':>9} {'p95ms':>9} {'bytes':>9} {'status'}")
    print("-" * 70)
    for ep in ENDPOINTS:
        url = f"{BASE}{ep}"
        samples, status, size = [], 0, 0
        for _ in range(args.reps):
            ms, st, sz = timed(url)
            samples.append(ms)
            status, size = st, sz
        print(f"{ep:<26} {pct(samples, 50):>9.0f} {pct(samples, 95):>9.0f} "
              f"{size:>9} {status}")


if __name__ == "__main__":
    main()
