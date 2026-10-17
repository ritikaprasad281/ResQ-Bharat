"""One-off: run real SAR validation for each non-live AOI against its region's
documented flood window, via the deployed /validate endpoint. Prints the actual
precision/recall/IoU so we can honestly decide which areas qualify as "live".

Not part of the app. Run: python scripts/validation_sweep.py
"""

from __future__ import annotations

import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://ganga-flood-api-714160101954.asia-south1.run.app/api"

# Each non-live AOI -> candidate documented flood windows (best IoU wins).
CANDIDATES: dict[str, list[str]] = {
    # North
    "ludhiana": ["punjab_2023"],
    "pathankot": ["punjab_2023"],
    "yamunanagar": ["punjab_2023", "delhi_2023"],
    "chandigarh": ["punjab_2023"],
    "mandi": ["punjab_2023"],
    # Central
    "jabalpur": ["mp_2022", "mp_2019"],
    "narmadapuram": ["mp_2019", "mp_2022"],
    "bhopal": ["mp_2022", "mp_2019"],
    "kota": ["rajasthan_2024", "mp_2022"],
    "orchha": ["mp_2022"],
    "banda": ["mp_2022"],
    "raipur": ["mp_2022", "odisha_2022"],
    "nagpur": ["mp_2022", "maharashtra_2019"],
    # West
    "surat": ["gujarat_2024", "gujarat_2017"],
    "bharuch": ["gujarat_2024", "gujarat_2017"],
    "ahmedabad": ["gujarat_2017", "gujarat_2024"],
    "vadodara": ["gujarat_2024", "gujarat_2017"],
    "daman": ["gujarat_2024", "maharashtra_2021"],
    "nashik": ["maharashtra_2019", "godavari_2022"],
    "nanded": ["godavari_2022", "maharashtra_2019"],
    "sangli": ["maharashtra_2021", "maharashtra_2019", "krishna_2019"],
    "kolhapur": ["maharashtra_2021", "maharashtra_2019", "krishna_2019"],
    "pandharpur": ["maharashtra_2019", "krishna_2019"],
    "mumbai": ["maharashtra_2021"],
    "panaji": ["goa_2021", "maharashtra_2021"],
    "balotra": ["rajasthan_2024"],
    # South
    "trichy": ["tn_michaung_2023", "tn_chennai_2021"],
    "madurai": ["tn_michaung_2023", "tn_chennai_2021"],
    "tirunelveli": ["tn_michaung_2023", "tn_chennai_2021"],
    "chennai": ["tn_chennai_2021", "tn_michaung_2023"],
    "puducherry": ["tn_chennai_2021", "tn_michaung_2023"],
    "vellore": ["tn_chennai_2021", "tn_michaung_2023"],
    "nellore": ["tn_chennai_2021", "krishna_2019"],
    "mysuru": ["karnataka_2019"],
    "bengaluru": ["bengaluru_2022"],
    "hyderabad": ["telangana_2020"],
    "vijayawada": ["godavari_2022", "krishna_2019"],
    "rajahmundry": ["godavari_2022", "krishna_2019"],
    "bhadrachalam": ["godavari_2022", "krishna_2019"],
    "kochi": ["kerala_2018", "kerala_2019"],
    "chengannur": ["kerala_2018", "kerala_2019"],
    "pattambi": ["kerala_2018", "kerala_2019"],
    # East
    "jamshedpur": ["wb_2021", "odisha_2022"],
    "sambalpur": ["odisha_2022"],
    "cuttack": ["odisha_2022"],
    "bhubaneswar": ["odisha_2022"],
    "rourkela": ["odisha_2022"],
    "bhadrak": ["odisha_2022"],
    "durgapur": ["wb_2021"],
    "kolkata": ["wb_2021"],
    "jalpaiguri": ["sikkim_teesta_2023", "wb_2021"],
    "siliguri": ["sikkim_teesta_2023", "wb_2021"],
    # NE additional
    "northlakhimpur": ["assam_2022", "assam_2026"],
    "barpeta": ["assam_2022", "assam_2026"],
    "nagaon": ["assam_2022", "assam_2026"],
    "dhubri": ["assam_2022", "assam_2026"],
    "digboi": ["assam_2022", "assam_2026"],
    "tezu": ["assam_2022"],
    "roing": ["assam_2022"],
    "bhalukpong": ["assam_2022"],
    "shillong": ["assam_2022"],
}


def fetch(aoi: str, event: str) -> tuple[str, str, dict]:
    url = f"{BASE}/validate?pilot={aoi}&event={event}"
    try:
        with urllib.request.urlopen(url, timeout=150) as r:
            return aoi, event, json.loads(r.read().decode())
    except Exception as e:  # noqa: BLE001
        return aoi, event, {"error": str(e)}


def main() -> None:
    jobs = [(a, ev) for a, evs in CANDIDATES.items() for ev in evs]
    best: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = [pool.submit(fetch, a, ev) for a, ev in jobs]
        for fut in as_completed(futs):
            aoi, event, res = fut.result()
            if "error" in res:
                print(f"  ERR {aoi:<14} {event:<20} {res['error'][:60]}")
                continue
            iou = res.get("iou", 0.0)
            prev = best.get(aoi)
            if prev is None or iou > prev["iou"]:
                best[aoi] = {
                    "event": event, "iou": iou,
                    "precision": res.get("precision", 0.0),
                    "recall": res.get("recall", 0.0),
                }
            print(f"  ok  {aoi:<14} {event:<20} IoU={iou:.3f} "
                  f"P={res.get('precision', 0):.2f} R={res.get('recall', 0):.2f}")

    print("\n===== BEST PER AOI (sorted by IoU) =====")
    rows = sorted(best.items(), key=lambda kv: kv[1]["iou"], reverse=True)
    for aoi, m in rows:
        print(f"  {aoi:<14} IoU={m['iou']:.3f}  P={m['precision']:.2f}  "
              f"R={m['recall']:.2f}  via {m['event']}")

    for thr in (0.5, 0.4, 0.35, 0.3, 0.25, 0.2):
        passing = [a for a, m in rows if m["iou"] >= thr]
        print(f"\nIoU >= {thr}: {len(passing)} AOIs -> {passing}")


if __name__ == "__main__":
    main()
