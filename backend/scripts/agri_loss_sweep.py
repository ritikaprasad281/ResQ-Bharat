"""One-off: warm the agri-loss cache for every AOI via the deployed
/agri-loss endpoint so /agri-loss-summary has data to roll up.

Not part of the app. Run: python scripts/agri_loss_sweep.py
"""

from __future__ import annotations

import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://ganga-flood-api-714160101954.asia-south1.run.app/api"


def _get(url: str, timeout: int) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read().decode())


def pilots() -> list[str]:
    data = _get(f"{BASE}/pilots", 60)
    items = data.get("pilots", data) if isinstance(data, dict) else data
    return [p["id"] for p in items]


def warm(aoi: str) -> tuple[str, dict]:
    url = f"{BASE}/agri-loss?pilot={aoi}"
    try:
        return aoi, _get(url, 580)
    except Exception as e:  # noqa: BLE001
        return aoi, {"error": str(e)}


def main() -> None:
    ids = pilots()
    print(f"Warming agri-loss for {len(ids)} AOIs...\n")
    ok, err = 0, 0
    start = time.time()
    with ThreadPoolExecutor(max_workers=3) as pool:
        futs = [pool.submit(warm, a) for a in ids]
        for fut in as_completed(futs):
            aoi, res = fut.result()
            if "error" in res:
                err += 1
                print(f"  ERR {aoi:<16} {res['error'][:70]}")
                continue
            ok += 1
            sev = (res.get("severity") or {}).get("level", "?")
            print(f"  ok  {aoi:<16} sev={sev:<9} "
                  f"cropland={round(res.get('cropland_ha', 0)):>8} ha  "
                  f"damaged={round(res.get('damaged_cropland_ha', 0)):>7} ha  "
                  f"loss={res.get('estimated_loss_crore', 0)} Cr")

    mins = (time.time() - start) / 60
    print(f"\nDone: {ok} ok, {err} err, {mins:.1f} min")


if __name__ == "__main__":
    main()
