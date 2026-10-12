# Exploration: how does the Purdue API expose nutrition for bars like "Salad Bar"?
# Prints raw records so we can see child items, plus the GraphQL schema for item types.
import json
import datetime
import zoneinfo
import requests

BASE = "https://api.hfs.purdue.edu/menus"
HEADERS = {"Accept": "application/json", "User-Agent": "fuel-tracker personal menu fetcher"}
today = datetime.datetime.now(zoneinfo.ZoneInfo("America/New_York")).date().isoformat()

r = requests.get(BASE + "/v2/locations/Wiley/" + today, headers=HEADERS, timeout=30)
data = r.json()
shown = 0
bar_ids = []
for meal in data.get("Meals", []):
    for station in meal.get("Stations", []):
        for item in station.get("Items", []):
            if not item.get("NutritionReady") and shown < 4:
                print("=== RAW LOCATION ITEM", meal["Name"], "/", station["Name"])
                print(json.dumps(item, indent=1)[:2500])
                shown += 1
                bar_ids.append(item["ID"])
        if shown == 0 and station is meal["Stations"][0]:
            print("=== STATION KEYS", list(station.keys()))
print("=== MEAL KEYS", list(data["Meals"][0].keys()) if data.get("Meals") else None)

for item_id in bar_ids[:3]:
    r = requests.get(BASE + "/v2/items/" + item_id, headers=HEADERS, timeout=30)
    print("=== /v2/items/" + item_id, r.status_code)
    print(r.text[:3000])

gql = "https://api.hfs.purdue.edu/menus/v3/GraphQL"
q = "{ __schema { types { name kind fields { name type { name kind ofType { name kind ofType { name } } } } } } }"
r = requests.post(gql, json={"query": q}, headers=HEADERS, timeout=30)
print("=== GRAPHQL schema", r.status_code)
if r.status_code == 200:
    for t in r.json()["data"]["__schema"]["types"]:
        if t["kind"] == "OBJECT" and not t["name"].startswith("__") and t["fields"]:
            print(t["name"], ":", ", ".join(f["name"] for f in t["fields"]))
else:
    print(r.text[:1500])

if bar_ids:
    q = '{ itemByItemId(itemId: "' + bar_ids[0] + '") { name } }'
    r = requests.post(gql, json={"query": q}, headers=HEADERS, timeout=30)
    print("=== GRAPHQL itemByItemId", r.status_code, r.text[:1500])

# Beverages: any station or item name that looks like a drink, across courts.
for court in ["Earhart", "Ford", "Hillenbrand", "Windsor"]:
    r = requests.get(BASE + "/v2/locations/" + court + "/" + today, headers=HEADERS, timeout=30)
    for meal in r.json().get("Meals", []):
        for station in meal.get("Stations", []):
            for item in station.get("Items", []):
                n = item["Name"].lower()
                if any(w in n for w in ["milk", "juice", "coffee", "cocoa", "chocolate milk", "soda", "tea", "lemonade", "drink", "beverage", "water"]):
                    print("DRINK?", court, meal["Name"], station["Name"], item["Name"], item.get("NutritionReady"))
