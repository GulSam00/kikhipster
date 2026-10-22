# -*- coding: utf-8 -*-
import io
import json
import random

d = json.load(io.open("_workspace/spike_coverage.json", encoding="utf-8"))
random.seed(7)
rows = d["artists"]
out = []
for cls in ("no_item", "hangul", "item_no_ko", "latin_same"):
    pick = random.sample([r for r in rows if r["cls"] == cls], 14 if cls in ("no_item", "hangul") else 6)
    out.append("== %s" % cls)
    out += ["%-28s (%s, rank %d)" % (r["name"], r["term"], r["rank"]) for r in pick]
io.open("_workspace/spike_peek.txt", "w", encoding="utf-8").write("\n".join(out))
