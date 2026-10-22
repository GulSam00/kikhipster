# -*- coding: utf-8 -*-
"""아티스트 한국어 이름 검증 스파이크 (일회용 — 앱 코드 아님).

질문: iTunes 아티스트 ID 로 Wikidata(P2850)를 조회하면 한국어 라벨을 몇 명이나 얻는가?
비교 대상: iTunes 가 KR 로 줘도 영어로 남는 이름(현재 상태).
"""
import io
import json
import sys
import time
import urllib.parse
import urllib.request

UA = {"User-Agent": "kikhipster-spike/0.1 (gulsamcono@gmail.com)"}

# 장르·지역이 섞인 표본. (검색어, 기대하는 한국어 이름) — 기대값은 내가 아는 관용 표기이며 채점용이다.
SAMPLE = [
    ("IU", "아이유"), ("BTS", "방탄소년단"), ("NewJeans", "뉴진스"), ("BLACKPINK", "블랙핑크"),
    ("aespa", "에스파"), ("Stray Kids", "스트레이 키즈"), ("SEVENTEEN", "세븐틴"), ("Epik High", "에픽하이"),
    ("Hyukoh", "혁오"), ("Zion.T", "자이언티"), ("Crush", "크러쉬"), ("Dean", "딘"),
    ("Radiohead", "라디오헤드"), ("The Beatles", "비틀즈"), ("Coldplay", "콜드플레이"), ("Adele", "아델"),
    ("Taylor Swift", "테일러 스위프트"), ("Billie Eilish", "빌리 아일리시"), ("Ed Sheeran", "에드 시런"),
    ("Queen", "퀸"), ("Nirvana", "너바나"), ("Daft Punk", "다프트 펑크"), ("Bruno Mars", "브루노 마스"),
    ("Kenshi Yonezu", "요네즈 켄시"), ("YOASOBI", "요아소비"), ("Ado", "아도"),
    ("Arctic Monkeys", "악틱 몽키즈"), ("Tame Impala", "테임 임팔라"), ("Mac DeMarco", "맥 드마르코"),
    ("Kendrick Lamar", "켄드릭 라마"),
]


def get(url):
    """429(iTunes 는 분당 20회 안팎) 이면 물러났다가 다시 시도한다."""
    for wait in (0, 15, 30, 60):
        time.sleep(wait)
        req = urllib.request.Request(url, headers=UA)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
    raise RuntimeError("rate limited: " + url)


def itunes_artist(name):
    q = urllib.parse.urlencode({"term": name, "entity": "musicArtist", "limit": 1, "country": "US"})
    res = get("https://itunes.apple.com/search?" + q).get("results", [])
    return (str(res[0]["artistId"]), res[0]["artistName"]) if res else (None, None)


def wikidata_ko_by_itunes_ids(ids):
    """P2850 으로 한 번에 조회. 한국어 라벨이 없으면 ko 가 빈다."""
    values = " ".join('"%s"' % i for i in ids)
    sparql = (
        "SELECT ?id ?item ?ko ?en WHERE { VALUES ?id { %s } ?item wdt:P2850 ?id . "
        "OPTIONAL { ?item rdfs:label ?ko FILTER(LANG(?ko)='ko') } "
        "OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en)='en') } }" % values
    )
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": sparql, "format": "json"})
    out = {}
    for row in get(url)["results"]["bindings"]:
        out.setdefault(row["id"]["value"], []).append(
            {"item": row["item"]["value"].rsplit("/", 1)[-1],
             "ko": row.get("ko", {}).get("value"), "en": row.get("en", {}).get("value")}
        )
    return out


def main():
    rows = []
    for name, expected in SAMPLE:
        aid, itunes_name = itunes_artist(name)
        rows.append({"query": name, "expected": expected, "itunes_id": aid, "itunes_name": itunes_name})
        time.sleep(3.2)  # 분당 20회 제한 아래로
    ids = [r["itunes_id"] for r in rows if r["itunes_id"]]
    wd = wikidata_ko_by_itunes_ids(ids)
    for r in rows:
        hits = wd.get(r["itunes_id"], [])
        r["wd_hits"] = len(hits)
        r["wd_ko"] = next((h["ko"] for h in hits if h["ko"]), None)
        r["wd_item"] = hits[0]["item"] if hits else None
        r["match"] = (r["wd_ko"] == r["expected"]) if r["wd_ko"] else None

    found = [r for r in rows if r["wd_item"]]
    with_ko = [r for r in rows if r["wd_ko"]]
    exact = [r for r in rows if r["match"]]
    summary = {
        "n": len(rows),
        "itunes_resolved": len(ids),
        "wikidata_item_found_by_P2850": len(found),
        "has_korean_label": len(with_ko),
        "korean_label_equals_expected": len(exact),
        "multi_item_ambiguity": sum(1 for r in rows if r["wd_hits"] > 1),
    }
    with io.open(sys.argv[1], "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "rows": rows}, f, ensure_ascii=False, indent=1)


main()
