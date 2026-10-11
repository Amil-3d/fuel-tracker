# One-off exploration of Virginia Tech dining menu pages.
import re
import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (fuel-tracker personal menu fetcher)"}
urls = [
    "https://foodpro.students.vt.edu/menus/",
    "https://foodpro.students.vt.edu/",
    "https://dining.vt.edu/menus.html",
    "https://www.dining.vt.edu/",
    "https://dining.vt.edu/",
]
for url in urls:
    print("=" * 80)
    r = requests.get(url, headers=HEADERS, timeout=30, allow_redirects=True)
    print(url, "->", r.status_code, r.url, r.headers.get("content-type"), len(r.content))
    if r.status_code != 200 or "html" not in (r.headers.get("content-type") or ""):
        print(r.text[:500])
        continue
    soup = BeautifulSoup(r.text, "html.parser")
    print("TITLE:", soup.title.string if soup.title else None)
    seen = set()
    for a in soup.find_all("a", href=True):
        h = a["href"]
        t = " ".join(a.get_text().split())
        if re.search(r"menu|location|label|nutri|foodpro|dining|aspx|hall|market", h + t, re.I) and h not in seen:
            seen.add(h)
            print("LINK:", t[:60], "|", h[:200])
    forms = soup.find_all("form")
    for f in forms:
        print("FORM:", f.get("action"), [i.get("name") for i in f.find_all(["input", "select"])][:20])
    scripts = [s.get("src") for s in soup.find_all("script") if s.get("src")]
    print("SCRIPTS:", scripts[:15])
    text = " ".join(soup.get_text().split())
    print("TEXT:", text[:1500])
