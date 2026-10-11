# One-off exploration of the undocumented Purdue HFS dining API.
# Saves raw responses to explore/ and prints a short preview of each.
import json
import os
import datetime
import zoneinfo
import requests

BASE = "https://api.hfs.purdue.edu/menus"
HEADERS = {"Accept": "application/json", "User-Agent": "fuel-tracker personal menu fetcher"}
today = datetime.datetime.now(zoneinfo.ZoneInfo("America/New_York")).date().isoformat()
os.makedirs("explore", exist_ok=True)


def show(label, response, filename):
    print("=" * 80)
    print(label, "->", response.status_code, response.headers.get("content-type"), len(response.content), "bytes")
    f = open("explore/" + filename, "wb")
    f.write(response.content)
    f.close()
    text = response.text
    if "json" in (response.headers.get("content-type") or ""):
        text = json.dumps(response.json(), indent=2)
    print(text[:3000])


r = requests.get(BASE + "/v2/locations", headers=HEADERS, timeout=30)
show("GET /v2/locations", r, "locations.json")

names = []
if r.status_code == 200 and "json" in (r.headers.get("content-type") or ""):
    data = r.json()
    locs = data.get("Location", data) if isinstance(data, dict) else data
    for loc in locs:
        if isinstance(loc, dict):
            names.append(loc.get("Name"))
print("Location names:", names)

first_item = None
for name in ["Wiley", "Earhart"]:
    r = requests.get(BASE + "/v2/locations/" + name + "/" + today, headers=HEADERS, timeout=30)
    show("GET /v2/locations/" + name + "/" + today, r, "menu_" + name + ".json")
    if first_item is None and r.status_code == 200 and "json" in (r.headers.get("content-type") or ""):
        for meal in r.json().get("Meals", []):
            for station in meal.get("Stations", []):
                for item in station.get("Items", []):
                    if first_item is None:
                        first_item = item.get("ID")

print("First item ID:", first_item)
if first_item:
    r = requests.get(BASE + "/v2/items/" + str(first_item), headers=HEADERS, timeout=30)
    show("GET /v2/items/" + str(first_item), r, "item.json")

# Lowercase location name, to confirm case sensitivity.
r = requests.get(BASE + "/v2/locations/wiley/" + today, headers=HEADERS, timeout=30)
show("GET /v2/locations/wiley (lowercase)", r, "menu_wiley_lower.json")

# A newer GraphQL endpoint may return nutrition in one request; check what it exposes.
query = "{ __schema { queryType { fields { name args { name } } } } }"
r = requests.post(BASE + "/v3/GraphQL", json={"query": query}, headers=HEADERS, timeout=30)
show("POST /v3/GraphQL (schema fields)", r, "graphql_schema.json")
