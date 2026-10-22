# -*- coding: utf-8 -*-
"""Wikidata 에 항목이 없는 아티스트를 KR 앨범 응답의 artistName 으로 보완할 수 있는가."""
import io
import json
import time
import urllib.request

UA = {"User-Agent": "kikhipster-spike/0.1 (gulsamcono@gmail.com)"}
# (표시 이름, iTunes 아티스트 ID) — 1차에서 Wikidata 에 없던 2명 + 이번 표본의 유명 미적중자
TARGETS = [("Epik High", "139334133"), ("HYUKOH", "927548906")]


def lookup(aid, country):
    url = "https://itunes.apple.com/lookup?id=%s&entity=album&limit=8&country=%s" % (aid, country)
    for wait in (0, 20, 40):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))["results"]
        except Exception:
            continue
    return []


out = []
for name, aid in TARGETS:
    names = [r.get("artistName") for r in lookup(aid, "KR")]
    out.append("%s (%s) KR album artistNames: %s" % (name, aid, sorted(set(n for n in names if n))))
    time.sleep(4)
io.open("_workspace/spike_album_fallback.txt", "w", encoding="utf-8").write("\n".join(out))
