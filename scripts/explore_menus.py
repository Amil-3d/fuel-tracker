# Exploration: Purdue GraphQL components (salad bar parts) and their nutrition.
import json
import datetime
import zoneinfo
import requests

GQL = "https://api.hfs.purdue.edu/menus/v3/GraphQL"
HEADERS = {"Accept": "application/json", "User-Agent": "fuel-tracker personal menu fetcher"}
today = datetime.datetime.now(zoneinfo.ZoneInfo("America/New_York")).date().isoformat()

q = "{ __schema { types { name fields { name args { name type { name kind ofType { name } } } type { name kind ofType { name kind ofType { name kind ofType { name } } } } } } } }"
r = requests.post(GQL, json={"query": q}, headers=HEADERS, timeout=30)
for t in r.json()["data"]["__schema"]["types"]:
    if t["name"] in ("MenusQuery", "DiningCourt", "ItemAppearance", "Item", "Station", "MealMenu", "NutritionFact"):
        for f in t["fields"]:
            if t["name"] == "MenusQuery" and f["name"] not in ("diningCourtByName", "itemByItemId"):
                continue
            print(t["name"] + "." + f["name"], json.dumps(f["args"]), json.dumps(f["type"]))

for court in ["Wiley", "Earhart", "Ford"]:
    q = '{ diningCourtByName(name: "' + court + '") { dailyMenu(date: "' + today + '") { meals { name stations { name items { displayName hasComponents item { itemId name isNutritionReady } components { displayName item { itemId name isNutritionReady nutritionFacts { name value label } } } } } } } } }'
    r = requests.post(GQL, json={"query": q}, headers=HEADERS, timeout=60)
    print("=== ", court, r.status_code, len(r.content))
    data = r.json()
    if "errors" in data:
        print(json.dumps(data["errors"])[:2000])
        continue
    shown = 0
    for meal in data["data"]["diningCourtByName"]["dailyMenu"]["meals"]:
        for st in meal["stations"]:
            for it in st["items"]:
                if it["hasComponents"] and shown < 3:
                    print("--", meal["name"], st["name"], it["displayName"], it["item"])
                    print(json.dumps(it["components"])[:3000])
                    shown += 1
