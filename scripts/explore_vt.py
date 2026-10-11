# One-off exploration of Virginia Tech dining (round 3: JSON API under /menus/API/).
import re
import json
import requests

HEADERS = {"User-Agent": "Mozilla/5.0 (fuel-tracker personal menu fetcher)"}
BASE = "https://foodpro.students.vt.edu"
API = BASE + "/menus/API/"

r = requests.get(API + "Locations.aspx", headers=HEADERS, timeout=30)
print("Locations.aspx ->", r.status_code, r.headers.get("content-type"), len(r.content))
locs = r.json()
print(json.dumps(locs[:2], indent=1)[:2500])
print("ALL:", [(l.get("name"), l.get("locationNum") or l.get("id") or l.get("locationId")) for l in locs])

loc = locs[0]
print("Keys:", list(loc.keys()))
loc_id = str(loc.get("locationNum") or loc.get("locationId") or loc.get("id"))

page = requests.get(BASE + "/menus/menu/?locationId=" + loc_id, headers=HEADERS, timeout=30)
print("menu page ->", page.status_code, len(page.text))
chunks = sorted(set(re.findall(r'(/menus/_next/static/chunks/[^"\']+\.js)', page.text)))
seen = set()
for c in chunks:
    js = requests.get(BASE + c, headers=HEADERS, timeout=30).text
    for m in re.finditer(r'\.aspx', js):
        s = js[max(0, m.start() - 250): m.start() + 200].replace("\n", " ")
        key = js[max(0, m.start() - 40): m.start() + 5]
        if key not in seen:
            seen.add(key)
            print("ASPX in", c.split("/")[-1], ":", s)
