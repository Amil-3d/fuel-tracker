# One-off exploration of Virginia Tech dining (round 4: menu + nutrition JSON).
import json
import datetime
import zoneinfo
import requests

HEADERS = {"User-Agent": "Mozilla/5.0 (fuel-tracker personal menu fetcher)"}
API = "https://foodpro.students.vt.edu/menus/API/"
d = datetime.datetime.now(zoneinfo.ZoneInfo("America/New_York")).date() + datetime.timedelta(days=1)
menu = None
for fmt in [d.strftime("%m/%d/%Y"), d.isoformat(), str(d.month) + "/" + str(d.day) + "/" + str(d.year)]:
    r = requests.get(API + "MenuAtLocation.aspx", params={"locationNum": "16", "dtdate": fmt}, headers=HEADERS, timeout=30)
    print("MenuAtLocation 16", fmt, "->", r.status_code, r.headers.get("content-type"), len(r.content))
    print(r.text[:300])
    if r.status_code == 200 and "json" in (r.headers.get("content-type") or "") and menu is None and len(r.content) > 200:
        menu = r.json()
        print("USING FORMAT", fmt)
print("MENU SHAPE:")
print(json.dumps(menu, indent=1)[:4000] if menu is not None else None)

items = []
def walk(x):
    if isinstance(x, dict):
        if "recipeId" in x or "recNum" in x:
            items.append(x)
        for v in x.values():
            walk(v)
    elif isinstance(x, list):
        for v in x:
            walk(v)
walk(menu)
print("ITEM COUNT:", len(items))
if items:
    print("ITEM KEYS:", list(items[0].keys()))
    q = ",".join(str(i.get("recipeId")) + "*" + str(i.get("portionCode") or (i.get("portionSize") or "1").split(" ")[0]) + "*1" for i in items[:3])
    r = requests.get(API + "NutritiveReport.aspx?items=" + q, headers=HEADERS, timeout=30)
    print("NutritiveReport", q, "->", r.status_code, r.headers.get("content-type"), len(r.content))
    print(r.text[:4000])
    first = items[0]
    r = requests.get(API + "Label.aspx", params={"locationNum": "16", "dtdate": d.strftime("%m/%d/%Y"), "recNumAndPort": str(first.get("recipeId")) + "*" + str(first.get("portionSize"))}, headers=HEADERS, timeout=30)
    print("Label ->", r.status_code, r.headers.get("content-type"), len(r.content))
    print(r.text[:2500])
