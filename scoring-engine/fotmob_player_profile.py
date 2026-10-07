"""
FotMob player profile page helpers: canonical display name + primary position
from embedded __NEXT_DATA__ JSON (same source as the website).
"""

from __future__ import annotations

import json
import re
import unicodedata
import urllib.error
import urllib.request
from typing import Any

from bs4 import BeautifulSoup


def fetch_html(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            )
        },
    )
    return urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "ignore")


def clean_player_display_name(raw: str) -> str:
    """Strip injury junk sometimes merged into link text or headers."""
    text = (raw or "").replace("icInjury", "").strip()
    injury_start_re = re.compile(
        r"(?i)\b("
        r"injured|knock|strain injury|knee injury|broken leg|broken foot|"
        r"hamstring injury|cruciate ligament injury|calf injury|thigh injury|"
        r"ankle injury|sprained ankle|sprained|physical discomfort|"
        r"bruise|bruised|muscle injury|tendon injury"
        r")\b"
    )
    m = injury_start_re.search(text)
    if m:
        text = text[: m.start()].strip()
    text = re.split(r"(?i)\bexpected return\b", text)[0].strip()
    return text.strip(" -–—,;")


def repair_utf8_mojibake(s: str) -> str:
    """
    Reverse common mojibake: UTF-8 text was decoded as Latin-1 / cp1252
    (e.g. 'AurÃ©lien' instead of 'Aurélien'). No-op if the string does not
    look like that pattern or if round-tripping fails.
    """
    if not s or ("Ã" not in s and "Â" not in s):
        return s
    try:
        return s.encode("latin-1").decode("utf-8")
    except UnicodeError:
        return s


def finalize_player_display_name(raw: str | None) -> str | None:
    """Clean injury suffixes, repair accidental mojibake, Unicode NFC."""
    if raw is None:
        return None
    s = clean_player_display_name(str(raw))
    if not s:
        return None
    s = repair_utf8_mojibake(s)
    s = unicodedata.normalize("NFC", s)
    return s


def parse_next_data(html: str) -> dict[str, Any] | None:
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def display_name_from_payload(d: dict[str, Any]) -> str | None:
    data = d.get("props", {}).get("pageProps", {}).get("data")
    if not isinstance(data, dict):
        return None
    name = data.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return None


def position_description_from_payload(d: dict[str, Any]) -> dict | None:
    data = d.get("props", {}).get("pageProps", {}).get("data")
    if not isinstance(data, dict):
        return None
    pd = data.get("positionDescription")
    if not pd:
        fb = d.get("props", {}).get("pageProps", {}).get("fallback") or {}
        for v in fb.values():
            if isinstance(v, dict) and "positionDescription" in v:
                pd = v.get("positionDescription")
                break
    return pd if isinstance(pd, dict) else None


def primary_position_label(pd: dict | None) -> str | None:
    if not pd:
        return None
    for p in pd.get("positions") or []:
        if not p.get("isMainPosition"):
            continue
        ss = p.get("strPosShort") or {}
        if ss.get("label"):
            return str(ss["label"]).strip()
        sp = p.get("strPos") or {}
        if sp.get("label"):
            return str(sp["label"]).strip()
    prim = pd.get("primaryPosition") or {}
    if prim.get("label"):
        return str(prim["label"]).strip()
    return None


def display_name_from_html_fallback(html: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    if not h1:
        return None
    return clean_player_display_name(h1.get_text(" ", strip=True)) or None


def fetch_player_display_name_and_primary_position(
    href: str,
) -> tuple[str | None, str | None]:
    """
    Returns (display_name, primary_position_short_or_label).
    On failure returns (None, None) for missing parts.
    """
    if not href:
        return None, None
    try:
        html = fetch_html(href)
    except (urllib.error.URLError, OSError, TimeoutError):
        return None, None

    d = parse_next_data(html)
    name: str | None = None
    pos: str | None = None

    if d:
        name = display_name_from_payload(d)
        pd = position_description_from_payload(d)
        pos = primary_position_label(pd)

    if not name:
        name = display_name_from_html_fallback(html)

    if name:
        name = finalize_player_display_name(name)

    return name, pos
