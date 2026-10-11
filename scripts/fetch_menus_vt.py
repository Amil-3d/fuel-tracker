# Fetch Virginia Tech dining menus (today + next 2 days, Eastern time) with nutrition,
# and write them to data/menu-vt.json for the app. Same output shape as fetch_menus.py (Purdue).
#
# Requests are kept low: one location list request, one menu request per location per day,
# and nutrition in batches (NutritiveReport takes many items at once). Nutrition already saved
# in the previous menu-vt.json is reused.
import json
import os
import sys
import time
import datetime
import zoneinfo
import requests

API = "https://foodpro.students.vt.edu/menus/API/"
DAYS = 3
BATCH = 40
OUT = "data/menu-vt.json"
HEADERS = {"Accept": "application/json", "User-Agent": "Mozilla/5.0 (fuel-tracker personal menu fetcher, GitHub Actions, once daily)"}

# Nutrient names in NutritiveReport -> our keys
NUTRIENTS = {
    "Cals": "kcal",
    "Prot": "protein",
    "Carb": "carbs",
    "Fat-T": "fat",
    "Fiber": "fiber",
    "Sugar": "sugar",
    "Sod": "sodium",
}

session = requests.Session()
session.headers.update(HEADERS)
request_count = 0

today = datetime.datetime.now(zoneinfo.ZoneInfo("America/New_York")).date()
days = [today + datetime.timedelta(days=i) for i in range(DAYS)]
dates = [d.isoformat() for d in days]

# Reuse nutrition from the last run.
known = {}
if os.path.exists(OUT):
    f = open(OUT, "r", encoding="utf-8")
    previous = json.load(f)
    f.close()
    known = previous.get("items", {})
print("Nutrition cached from last run:", len(known), "items")

r = session.get(API + "Locations.aspx", timeout=30)
request_count += 1
# Long names like "Viva Market - Johnston Student Center & Viva Too  - Goodwin Hall" are cut at the first " - ".
locations = [(str(loc["locationNum"]), " ".join(loc["name"].split(" - ")[0].split())) for loc in r.json()]
print("Locations:", len(locations))

menus = {}
items = {}
needed = []
courts = []

for num, name in locations:
    menus[name] = {}
    for d in days:
        r = session.get(API + "MenuAtLocation.aspx", params={"locationNum": num, "dtdate": d.strftime("%m/%d/%Y")}, timeout=30)
        request_count += 1
        time.sleep(0.15)
        if r.status_code != 200:
            print("Skipping", name, d, "-> HTTP", r.status_code)
            continue
        meals = []
        for meal in r.json().get("meals", []):
            stations = []
            for section in meal.get("sections", []):
                ids = []
                for recipe in section.get("recipes", []):
                    portion = str(recipe.get("portionSize") or "1").strip()
                    # The same recipe can be served in different portions, so the portion is part of the ID.
                    item_id = recipe["recipeId"] + "*" + portion
                    if item_id not in ids:
                        ids.append(item_id)
                    if item_id not in items:
                        codes = recipe.get("legendCodes") or []
                        unit = (recipe.get("portionUnit") or "").strip().lower()
                        allergens = [a.strip() for a in (recipe.get("allergens") or "").split(",") if a.strip()]
                        items[item_id] = {
                            "name": recipe["name"].strip(),
                            "veg": "WCVTN" in codes or "WCVEG" in codes,
                            "vegan": "WCVEG" in codes,
                            "allergens": allergens,
                            "serving": (portion + " " + unit).strip(),
                        }
                        if item_id in known and known[item_id].get("kcal") is not None:
                            for key in NUTRIENTS.values():
                                items[item_id][key] = known[item_id].get(key)
                        else:
                            needed.append(item_id)
                if ids:
                    stations.append({"name": section["sectionName"].strip(), "items": ids})
            if stations:
                meals.append({"name": meal["mealName"].strip(), "start": None, "end": None, "stations": stations})
        if meals:
            menus[name][d.isoformat()] = meals
        print(name, d, "->", len(meals), "meals")
    if menus[name]:
        courts.append(name)
    else:
        del menus[name]

print("New items needing nutrition:", len(needed))
for start in range(0, len(needed), BATCH):
    batch = needed[start:start + BATCH]
    # The API wants literal * and , separators, so the query is built by hand.
    r = session.get(API + "NutritiveReport.aspx?items=" + ",".join(item_id + "*1" for item_id in batch), timeout=60)
    request_count += 1
    time.sleep(0.15)
    if r.status_code != 200:
        print("No nutrition for batch at", start, "-> HTTP", r.status_code)
        continue
    for recipe in r.json().get("recipes", []):
        item_id = recipe["id"] + "*" + str(recipe.get("portionSize") or "1").strip()
        if item_id not in items:
            continue
        for n in recipe.get("nutrients", []):
            value = (n.get("value") or "").strip()
            if n["name"] in NUTRIENTS and value.replace(".", "", 1).isdigit():
                items[item_id][NUTRIENTS[n["name"]]] = round(float(value), 1)

missing = [i for i in items if items[i].get("kcal") is None]
print("Items:", len(items), "| without nutrition:", len(missing), "| requests:", request_count)

if not courts:
    print("No menus were returned; leaving", OUT, "unchanged.")
    sys.exit(1)

result = {
    "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "school": "vt",
    "dates": dates,
    "courts": courts,
    "menus": menus,
    "items": items,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
f = open(OUT, "w", encoding="utf-8")
json.dump(result, f, separators=(",", ":"), ensure_ascii=False, sort_keys=True)
f.close()
print("Wrote", OUT, os.path.getsize(OUT), "bytes")
