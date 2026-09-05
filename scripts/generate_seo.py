#!/usr/bin/env python3
"""
Regenerates the JSON-LD structured data baked into index.html
(<!-- SEO:JSONLD:START/END --> in <head>) from coffee.json.

This is invisible metadata for search engines/crawlers only — it has no
effect on the visible page. Run this any time coffee.json changes (a shop
added or edited) so the structured data stays in sync with the live map:

    python3 scripts/generate_seo.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_URL = "https://sonnyloweus.github.io/"
BIO = (
    "Hi, I’m Sonny Lowe. This map is a personal portfolio project tracking "
    "every coffee shop I’ve visited, scored across richness, craft, ambiance, "
    "character, and value. It’s part coffee repository, part excuse to "
    "experiment with statistics, data visualization, and clustering. Explore my "
    "experiences, discretized into coffee shops, and play a custom Coffee-Guessr "
    "puzzle."
)

def build_jsonld(shops):
    person = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": "Sonny Lowe",
        "url": SITE_URL,
        "description": BIO,
        "sameAs": [
            "https://github.com/sonnyloweus",
            "https://www.linkedin.com/in/lowesonny/",
        ],
    }

    items = []
    for i, c in enumerate(shops, start=1):
        address = {"@type": "PostalAddress"}
        if c.get("area"):
            address["addressLocality"] = c["area"]
        if c.get("state"):
            address["addressRegion"] = c["state"]
        if c.get("country"):
            address["addressCountry"] = c["country"]

        entry = {
            "@type": "CafeOrCoffeeShop",
            "name": c["name"],
        }
        if len(address) > 1:
            entry["address"] = address
        if c.get("lat") is not None and c.get("lng") is not None:
            entry["geo"] = {
                "@type": "GeoCoordinates",
                "latitude": c["lat"],
                "longitude": c["lng"],
            }
        if c.get("mapsUrl"):
            entry["hasMap"] = c["mapsUrl"]
        if c.get("overall") is not None:
            entry["review"] = {
                "@type": "Review",
                "author": {"@type": "Person", "name": "Sonny Lowe"},
                "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": c["overall"],
                    "bestRating": 5,
                    "worstRating": 1,
                },
                "reviewBody": c.get("note", ""),
            }
        if c.get("price"):
            entry["priceRange"] = c.get("price")

        items.append({
            "@type": "ListItem",
            "position": i,
            "item": entry,
        })

    item_list = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Coffee shops reviewed by Sonny Lowe",
        "itemListOrder": "https://schema.org/ItemListUnordered",
        "numberOfItems": len(items),
        "itemListElement": items,
    }

    blocks = [
        '<script type="application/ld+json">\n' + json.dumps(person, indent=2, ensure_ascii=False) + '\n</script>',
        '<script type="application/ld+json">\n' + json.dumps(item_list, indent=2, ensure_ascii=False) + '\n</script>',
    ]
    return "\n".join(blocks)

def replace_between(content, start_marker, end_marker, new_inner):
    pattern = re.compile(re.escape(start_marker) + r".*?" + re.escape(end_marker), re.DOTALL)
    replacement = start_marker + "\n" + new_inner + "\n" + end_marker
    new_content, n = pattern.subn(lambda m: replacement, content)
    if n == 0:
        raise SystemExit(f"Markers not found: {start_marker} ... {end_marker}")
    return new_content

def main():
    shops = json.loads((ROOT / "coffee.json").read_text())
    index_path = ROOT / "index.html"
    content = index_path.read_text()
    content = replace_between(
        content,
        "<!-- SEO:JSONLD:START -->",
        "<!-- SEO:JSONLD:END -->",
        build_jsonld(shops),
    )
    index_path.write_text(content)
    print(f"Updated index.html JSON-LD with {len(shops)} shops.")

if __name__ == "__main__":
    main()
