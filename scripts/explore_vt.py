# One-off exploration of Virginia Tech dining menu pages (round 2: find the data API).
import re
import requests

HEADERS = {"User-Agent": "Mozilla/5.0 (fuel-tracker personal menu fetcher)"}
BASE = "https://foodpro.students.vt.edu"
r = requests.get(BASE + "/menus/", headers=HEADERS, timeout=30)
html = r.text
chunks = sorted(set(re.findall(r'(/menus/_next/static/chunks/[^"\']+\.js)', html)))
print("CHUNKS:", len(chunks))
found = set()
for c in chunks:
    js = requests.get(BASE + c, headers=HEADERS, timeout=30).text
    for m in re.findall(r'["\'`]((?:https?://|/)[A-Za-z0-9_\-./{}$?=&:%]*(?:api|menu|location|nutri|item|graphql|label)[A-Za-z0-9_\-./{}$?=&:%]*)["\'`]', js, re.I):
        if m not in found:
            found.add(m)
            print("URL in", c.split("/")[-1], ":", m[:200])
    for m in re.finditer(r'fetch\(', js):
        snippet = js[max(0, m.start() - 150): m.start() + 250].replace("\n", " ")
        print("FETCH in", c.split("/")[-1], ":", snippet)
print("RSC/inline data sample:")
for m in re.findall(r'self\.__next_f\.push\(\[1,"(.{0,600})', html)[:8]:
    print("  ", m)
