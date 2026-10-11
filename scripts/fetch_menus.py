# Fetch Purdue dining court menus (today + next 2 days, Eastern time) with nutrition,
# and write them to data/menu.json for the app.
#
# Requests are kept low: one menu request per court per day, plus one nutrition request
# per item we haven't seen before. Nutrition already saved in the previous menu.json is reused.
import json
import os
import sys
import time
import datetime
import zoneinfo
import requests

BASE = "https://api.hfs.purdue.edu/menus/v2"
COURTS = ["Earhart", "Ford", "Hillenbrand", "Wiley", "Windsor"]  # names are case-sensitive
DAYS = 3
OUT = "data/menu.json"
HEADERS = {"Accept": "application/json", "User-Agent": "fuel-tracker personal menu fetcher (GitHub Actions, once daily)"}

# Nutrition names in the API -> our keys
NUTRIENTS = {
    "Calories": "kcal",
    "Protein": "protein",
    "Total Carbohydrate": "carbs",
    "Total fat": "fat",
    "Dietary Fiber": "fiber",
    "Sugar": "sugar",
    "Sodium": "sodium",
    "Saturated fat": "satFat",
}

session = requests.Session()
session.headers.update(HEADERS)
request_count = 0

today = datetime.datetime.now(zoneinfo.ZoneInfo("America/New_York")).date()
dates = [(today + datetime.timedelta(days=i)).isoformat() for i in range(DAYS)]

# Reuse nutrition from the last run.
known = {}
if os.path.exists(OUT):
    f = open(OUT, "r", encoding="utf-8")
    previous = json.load(f)
    f.close()
    known = previous.get("items", {})
print("Nutrition cached from last run:", len(known), "items")

menus = {}
items = {}
needed = []

for court in COURTS:
    menus[court] = {}
    for date in dates:
        r = session.get(BASE + "/locations/" + court + "/" + date, timeout=30)
        request_count += 1
        if r.status_code != 200:
            print("Skipping", court, date, "-> HTTP", r.status_code)
            continue
        data = r.json()
        meals = []
        for meal in data.get("Meals", []):
            stations = []
            for station in meal.get("Stations", []):
                ids = []
                for item in station.get("Items", []):
                    item_id = item["ID"]
                    ids.append(item_id)
                    if item_id not in items:
                        allergens = [a["Name"] for a in item.get("Allergens", []) if a.get("Value") and a["Name"] not in ("Vegetarian", "Vegan")]
                        vegan = any(a["Name"] == "Vegan" and a.get("Value") for a in item.get("Allergens", []))
                        items[item_id] = {
                            "name": item["Name"].strip(),
                            "veg": bool(item.get("IsVegetarian")),
                            "vegan": vegan,
                            "allergens": allergens,
                        }
                        if item_id in known and known[item_id].get("kcal") is not None:
                            for key in ["serving"] + list(NUTRIENTS.values()):
                                items[item_id][key] = known[item_id].get(key)
                        elif item.get("NutritionReady"):
                            needed.append(item_id)
                if ids:
                    stations.append({"name": station["Name"].strip(), "items": ids})
            hours = meal.get("Hours")
            if stations:
                meals.append({
                    "name": meal["Name"],
                    "start": hours["StartTime"][:5] if hours else None,
                    "end": hours["EndTime"][:5] if hours else None,
                    "stations": stations,
                })
        if meals:
            menus[court][date] = meals
        print(court, date, "->", len(meals), "meals")

print("New items needing nutrition:", len(needed))
for item_id in needed:
    r = session.get(BASE + "/items/" + item_id, timeout=30)
    request_count += 1
    time.sleep(0.15)
    if r.status_code != 200:
        print("No nutrition for", item_id, "-> HTTP", r.status_code)
        continue
    for n in r.json().get("Nutrition", []):
        if n["Name"] == "Serving Size":
            items[item_id]["serving"] = (n.get("LabelValue") or "").strip() or None
        elif n["Name"] in NUTRIENTS and n.get("Value") is not None:
            items[item_id][NUTRIENTS[n["Name"]]] = round(n["Value"], 1)

missing = [i for i in items if items[i].get("kcal") is None]
print("Items:", len(items), "| without nutrition:", len(missing), "| requests:", request_count)

if not any(menus[c] for c in menus):
    print("No menus were returned; leaving", OUT, "unchanged.")
    sys.exit(1)

result = {
    "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "dates": dates,
    "courts": COURTS,
    "menus": menus,
    "items": items,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
f = open(OUT, "w", encoding="utf-8")
json.dump(result, f, separators=(",", ":"), ensure_ascii=False, sort_keys=True)
f.close()
print("Wrote", OUT, os.path.getsize(OUT), "bytes")
