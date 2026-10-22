# -*- coding: utf-8 -*-
"""아티스트 한국어 이름 적중률 재측정 (일회용 — 앱 코드 아님).

1차 스파이크는 유명 아티스트 30명이라 적중률이 부풀려졌다. 여기서는 일반 검색어로 나오는
아티스트를 순위 구간별로 뽑아 **롱테일까지** 잰다. 모집단 정의: "사용자가 장르·키워드로 검색할 때
iTunes 가 돌려주는 아티스트". 순위 1~10 은 인기 구간, 11~50 은 꼬리 구간으로 나눠 따로 센다.
"""
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = {"User-Agent": "kikhipster-spike/0.1 (gulsamcono@gmail.com)"}
TERMS = [
    "indie", "rock band", "hip hop", "발라드", "인디", "R&B", "jazz", "electronic",
    "j-pop", "k-pop", "trot", "heavy metal", "folk", "singer songwriter", "lofi", "punk",
]
HANGUL = re.compile(r"[가-힣]")


def get(url):
    for wait in (0, 15, 30, 60):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503):
                raise
    raise RuntimeError("rate limited: " + url)


def collect():
    seen = {}
    for term in TERMS:
        q = urllib.parse.urlencode({"term": term, "entity": "musicArtist", "limit": 50, "country": "US"})
        for rank, a in enumerate(get("https://itunes.apple.com/search?" + q).get("results", []), 1):
            aid = str(a["artistId"])
            if aid not in seen:
                seen[aid] = {"id": aid, "name": a["artistName"], "term": term, "rank": rank}
        time.sleep(3.2)  # iTunes 분당 20회 제한 아래로
    return list(seen.values())


def wikidata(ids):
    out = {}
    for i in range(0, len(ids), 80):
        chunk = ids[i : i + 80]
        values = " ".join('"%s"' % x for x in chunk)
        sparql = (
            "SELECT ?id ?item ?ko WHERE { VALUES ?id { %s } ?item wdt:P2850 ?id . "
            "OPTIONAL { ?item rdfs:label ?ko FILTER(LANG(?ko)='ko') } }" % values
        )
        url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": sparql, "format": "json"})
        for row in get(url)["results"]["bindings"]:
            out.setdefault(row["id"]["value"], []).append(row.get("ko", {}).get("value"))
        time.sleep(1)
    return out


def classify(name, hits):
    """hits: 그 ID 에 달린 Wikidata 항목들의 ko 라벨 목록(없으면 None)."""
    if hits is None:
        return "no_item"  # Wikidata 에 이 iTunes ID 가 연결된 항목이 없다
    ko = next((h for h in hits if h), None)
    if not ko:
        return "item_no_ko"  # 항목은 있는데 한국어 라벨이 없다
    ko = re.sub(r"\s*\([^)]*\)\s*$", "", ko).strip()  # '딘 (가수)' -> '딘'
    if HANGUL.search(ko):
        return "hangul"  # 쓸 수 있는 한국어 이름
    return "latin_same"  # 한국어 라벨이 영문 표기(NewJeans 류) — 병기할 한국어 이름은 없다


def main():
    artists = collect()
    wd = wikidata([a["id"] for a in artists])
    for a in artists:
        a["cls"] = classify(a["name"], wd.get(a["id"]))
        a["bucket"] = "top(1-10)" if a["rank"] <= 10 else "tail(11-50)"
        a["korean_name_in_itunes"] = bool(HANGUL.search(a["name"]))

    def rate(rows):
        n = len(rows) or 1
        c = {}
        for r in rows:
            c[r["cls"]] = c.get(r["cls"], 0) + 1
        return {"n": len(rows), **{k: v for k, v in sorted(c.items())},
                "hangul_pct": round(100 * c.get("hangul", 0) / n, 1),
                "any_label_pct": round(100 * (c.get("hangul", 0) + c.get("latin_same", 0)) / n, 1)}

    summary = {
        "all": rate(artists),
        "by_bucket": {b: rate([a for a in artists if a["bucket"] == b]) for b in ("top(1-10)", "tail(11-50)")},
        "by_term": {t: rate([a for a in artists if a["term"] == t]) for t in TERMS},
        "itunes_name_already_hangul": sum(1 for a in artists if a["korean_name_in_itunes"]),
    }
    with io.open(sys.argv[1], "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "artists": artists}, f, ensure_ascii=False, indent=1)


main()
