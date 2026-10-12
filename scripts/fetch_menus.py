# Fetch Purdue dining court menus (today + next 2 days, Eastern time) with nutrition,
# and write them to data/menu.json for the app.
#
# Uses the same GraphQL API as the Purdue Dining app. One request per court per day returns
# every item with its nutrition, including the parts of bars like "Salad Bar" or
# "Flame Grilled Burger Bar" (their "components"), which the older REST API left without nutrition.
import json
import os
import sys
import time
import datetime
import zoneinfo
import requests

GQL = "https://api.hfs.purdue.edu/menus/v3/GraphQL"
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

ITEM_FIELDS = "itemId name isNutritionReady traits { name type } nutritionFacts { name value label }"
QUERY = """query ($name: String!, $date: Date!) {
  diningCourtByName(name: $name) {
    dailyMenu(date: $date) {
      meals { name startTime endTime stations { name items {
        displayName hasComponents item { ITEM }
        components { displayName item { ITEM } }
      } } }
    }
  }
}""".replace("ITEM", ITEM_FIELDS)

session = requests.Session()
session.headers.update(HEADERS)
request_count = 0
trait_types = set()

today = datetime.datetime.now(zoneinfo.ZoneInfo("America/New_York")).date()
dates = [(today + datetime.timedelta(days=i)).isoformat() for i in range(DAYS)]

menus = {}
items = {}


# Save one item (if it's new) and return its ID.
def add_item(appearance):
    item = appearance["item"]
    item_id = item["itemId"]
    if item_id in items:
        return item_id
    traits = item.get("traits") or []
    names = [t["name"] for t in traits]
    for t in traits:
        trait_types.add(str(t.get("type")) + ":" + t["name"])
    record = {
        "name": (appearance.get("displayName") or item["name"]).strip(),
        "veg": "Vegetarian" in names or "Vegan" in names,
        "vegan": "Vegan" in names,
        "allergens": [t["name"] for t in traits if t["name"] not in ("Vegetarian", "Vegan") and str(t.get("type")).lower() == "allergen"],
    }
    if item.get("isNutritionReady"):
        for n in item.get("nutritionFacts") or []:
            if n["name"] == "Serving Size":
                record["serving"] = (n.get("label") or "").strip() or None
            elif n["name"] in NUTRIENTS and n.get("value") is not None:
                record[NUTRIENTS[n["name"]]] = round(n["value"], 1)
    items[item_id] = record
    return item_id


for court in COURTS:
    menus[court] = {}
    for date in dates:
        r = session.post(GQL, json={"query": QUERY, "variables": {"name": court, "date": date}}, timeout=60)
        request_count += 1
        time.sleep(0.3)
        if r.status_code != 200:
            print("Skipping", court, date, "-> HTTP", r.status_code)
            continue
        data = r.json()
        if data.get("errors"):
            print("Skipping", court, date, "->", json.dumps(data["errors"])[:300])
            continue
        daily = ((data.get("data") or {}).get("diningCourtByName") or {}).get("dailyMenu")
        meals = []
        for meal in (daily or {}).get("meals") or []:
            stations = []
            for station in meal.get("stations") or []:
                ids = []
                bars = []
                for appearance in station.get("items") or []:
                    parts = appearance.get("components") or []
                    if appearance.get("hasComponents") and parts:
                        # A bar: list its parts as their own station, like "Salad Stop: Salad Bar".
                        part_ids = []
                        for part in parts:
                            part_id = add_item(part)
                            if part_id not in part_ids:
                                part_ids.append(part_id)
                        bars.append({"name": station["name"].strip() + ": " + appearance["displayName"].strip(), "items": part_ids})
                        if not appearance["item"].get("isNutritionReady"):
                            continue
                    item_id = add_item(appearance)
                    if item_id not in ids:
                        ids.append(item_id)
                if ids:
                    stations.append({"name": station["name"].strip(), "items": ids})
                stations.extend(bars)
            if stations:
                meals.append({
                    "name": meal["name"],
                    "start": meal["startTime"][11:16] if meal.get("startTime") else None,
                    "end": meal["endTime"][11:16] if meal.get("endTime") else None,
                    "stations": stations,
                })
        if meals:
            menus[court][date] = meals
        print(court, date, "->", len(meals), "meals")

missing = [i for i in items if items[i].get("kcal") is None]
print("Items:", len(items), "| without nutrition:", len(missing), "| requests:", request_count)
print("Without nutrition:", sorted(set(items[i]["name"] for i in missing))[:60])
print("Trait types:", sorted(trait_types))

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
