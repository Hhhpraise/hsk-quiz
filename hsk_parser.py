# -*- coding: utf-8 -*-
"""
HSK v3 HTML Vocabulary Parser
-------------------------------
Parses the new HSK 3.0 multi-level HTML format (from hsk.academy or similar sites)
and produces a JSON file that matches the existing vocabulary format:

    {
        "levels": {
            "1": { "level": "1", "description": "...", "totalWords": N, "words": [...] },
            "2": { ... },
            ...
        },
        "summary": {
            "totalLevels": N,
            "totalWords": N,
            "wordCountByLevel": { "1": N, "2": N, ... }
        }
    }

Each word object:
    { "chinese": "...", "pinyin": "...", "english": "..." }

Usage
-----
    python hsk_parser.py                        # reads input.txt, writes hsk_vocabulary.json
    python hsk_parser.py my_file.html out.json  # custom paths
"""

import re
import json
import html
import sys
from typing import Dict, List, Any


# ---------------------------------------------------------------------------
# HTML parsing helpers
# ---------------------------------------------------------------------------

def _strip_tags(text: str) -> str:
    """Remove any residual HTML tags from a string."""
    return re.sub(r"<[^>]+>", "", text).strip()


def _clean_text(raw: str) -> str:
    """Decode HTML entities, collapse whitespace, and strip."""
    decoded = html.unescape(raw)
    collapsed = re.sub(r"\s+", " ", decoded)
    return collapsed.strip()


# ---------------------------------------------------------------------------
# Level-section extraction
# ---------------------------------------------------------------------------

# Matches the section wrapper: <section id="hsk-v3-level-N" ...>...</section>
_SECTION_RE = re.compile(
    r'<section[^>]+id=["\']hsk-v3-level-(\d+)["\'][^>]*>(.*?)</section>',
    re.DOTALL | re.IGNORECASE,
)

# Matches the "Vocabulary list – NNN words" heading inside a section
_HEADING_RE = re.compile(
    r'Vocabulary list\s*[-–]\s*(\d+)\s*words',
    re.IGNORECASE,
)

# Matches every <tr> that contains exactly three <td> cells (Word / Pinyin / Meaning)
# Handles multi-line cells and arbitrary attributes on tags.
_ROW_RE = re.compile(
    r"<tr[^>]*>\s*"
    r"<td[^>]*>(.*?)</td>\s*"
    r"<td[^>]*>(.*?)</td>\s*"
    r"<td[^>]*>(.*?)</td>\s*"
    r"</tr>",
    re.DOTALL | re.IGNORECASE,
)

# Header row keywords to skip
_HEADER_KEYWORDS = {"word", "pinyin", "meaning", "english", "translation"}


def _is_header_row(cells: List[str]) -> bool:
    """Return True if this row looks like a table header."""
    return all(c.lower() in _HEADER_KEYWORDS for c in cells if c)


def _parse_section(level: str, section_html: str, description: str) -> Dict[str, Any]:
    """
    Parse one <section> block and return a level dict in the target format.

    Duplicate Chinese characters are de-duplicated (first occurrence wins).
    """
    unique_words: Dict[str, Dict[str, str]] = {}

    for match in _ROW_RE.finditer(section_html):
        raw_chinese, raw_pinyin, raw_english = match.groups()

        chinese = _clean_text(_strip_tags(raw_chinese))
        pinyin  = _clean_text(_strip_tags(raw_pinyin))
        english = _clean_text(_strip_tags(raw_english))

        # Skip empty rows or header rows
        if not chinese or not pinyin or not english:
            continue
        if _is_header_row([chinese, pinyin, english]):
            continue

        # De-duplicate: first occurrence of a Chinese entry wins
        if chinese not in unique_words:
            unique_words[chinese] = {
                "chinese": chinese,
                "pinyin":  pinyin,
                "english": english,
            }

    words_list = list(unique_words.values())

    return {
        "level":       level,
        "description": description,
        "totalWords":  len(words_list),
        "words":       words_list,
    }


# ---------------------------------------------------------------------------
# Top-level parser
# ---------------------------------------------------------------------------

def parse_hsk_html(html_content: str) -> Dict[str, Any]:
    """
    Parse the full page HTML.

    Returns a dict with two top-level keys:
        "levels"  – one entry per HSK level found
        "summary" – aggregate statistics
    """
    levels: Dict[str, Any] = {}

    for section_match in _SECTION_RE.finditer(html_content):
        level_num   = section_match.group(1)          # e.g. "1", "2", …
        section_html = section_match.group(2)

        # Build a human-readable description from the heading if available
        heading_match = _HEADING_RE.search(section_html)
        if heading_match:
            word_count = heading_match.group(1)
            description = (
                f"HSK 3.0 Level {level_num} – Match Chinese characters to "
                f"pinyin and English translations ({word_count} words total)"
            )
        else:
            description = (
                f"HSK 3.0 Level {level_num} – Match Chinese characters to "
                f"pinyin and English translations"
            )

        level_data = _parse_section(level_num, section_html, description)
        levels[level_num] = level_data

    # Build summary
    word_count_by_level = {lvl: data["totalWords"] for lvl, data in levels.items()}
    total_words = sum(word_count_by_level.values())

    result = {
        "levels": levels,
        "summary": {
            "totalLevels":      len(levels),
            "totalWords":       total_words,
            "wordCountByLevel": word_count_by_level,
        },
    }

    return result


# ---------------------------------------------------------------------------
# Flat (single-level) convenience wrapper
# ---------------------------------------------------------------------------

def parse_single_level_html(
    html_content: str,
    level: str = "1",
    description: str = "Match Chinese characters to pinyin and English translations",
) -> Dict[str, Any]:
    """
    Parse HTML that contains only one level's table (no <section> wrappers).
    Returns a single-level dict in the same format as the original organise.py.
    """
    return _parse_section(level, html_content, description)


# ---------------------------------------------------------------------------
# File I/O helpers
# ---------------------------------------------------------------------------

def load_html_from_file(filepath: str) -> str:
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def save_json_file(data: Dict[str, Any], filepath: str = "hsk_vocabulary.json") -> None:
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved → {filepath}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    input_file  = sys.argv[1] if len(sys.argv) > 1 else "input.txt"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "hsk_vocabulary.json"

    print(f"Reading  : {input_file}")
    try:
        html_content = load_html_from_file(input_file)
    except FileNotFoundError:
        print(f"✗ File not found: {input_file}")
        sys.exit(1)

    result = parse_hsk_html(html_content)

    if not result["levels"]:
        # Fallback: try single-level parse (no <section> wrappers)
        print("  No <section id='hsk-v3-level-N'> blocks found – trying single-level parse …")
        result = parse_single_level_html(html_content)

    save_json_file(result, output_file)

    # Pretty-print summary
    summary = result.get("summary", {})
    print("\n── Summary ──────────────────────────────")
    print(f"  Levels parsed : {summary.get('totalLevels', 1)}")
    print(f"  Total words   : {summary.get('totalWords', result.get('totalWords', '?'))}")
    if "wordCountByLevel" in summary:
        print("  Words per level:")
        for lvl, count in sorted(summary["wordCountByLevel"].items(), key=lambda x: int(x[0])):
            print(f"    Level {lvl}: {count}")
    print("─────────────────────────────────────────\n")


if __name__ == "__main__":
    main()


# ---------------------------------------------------------------------------
# Quick self-test with the sample HTML from the conversation
# ---------------------------------------------------------------------------

SAMPLE_HTML = r"""
<section id="hsk-v3-level-1" class="rounded-2xl border border-base-300/70 bg-base-100/80 p-6 shadow-sm">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <p class="text-xs font-semibold uppercase tracking-[0.12rem] text-primary">HSK 3.0 Level 1</p>
            <h3 class="text-2xl font-bold text-base-content">
                Vocabulary list - 536 words
            </h3>
        </div>
    </div>
    <div class="mt-6 overflow-x-auto">
        <table class="table table-zebra w-full text-base">
            <thead>
            <tr class="text-sm uppercase tracking-wide text-base-content/70">
                <th class="whitespace-nowrap">Word</th>
                <th class="whitespace-nowrap">Pinyin</th>
                <th class="whitespace-nowrap">Meaning</th>
            </tr>
        </thead>
        <tbody>
            <tr class="align-top">
                <td class="font-semibold text-lg text-base-content">一</td>
                <td class="text-base-content/80">yī</td>
                <td class="text-base-content/70">one</td>
            </tr>
            <tr class="align-top">
                <td class="font-semibold text-lg text-base-content">一些</td>
                <td class="text-base-content/80">yī xiē</td>
                <td class="text-base-content/70">some</td>
            </tr>
            <tr class="align-top">
                <td class="font-semibold text-lg text-base-content">一半</td>
                <td class="text-base-content/80">yī bàn</td>
                <td class="text-base-content/70">half</td>
            </tr>
            <tr class="align-top">
                <td class="font-semibold text-lg text-base-content">中国</td>
                <td class="text-base-content/80">zhōng guó</td>
                <td class="text-base-content/70">China</td>
            </tr>
            <tr class="align-top">
                <td class="font-semibold text-lg text-base-content">和</td>
                <td class="text-base-content/80">hé</td>
                <td class="text-base-content/70">(joining two nouns) and; together with</td>
            </tr>
        </tbody>
        </table>
    </div>
</section>
"""


def run_self_test() -> None:
    """Parse the embedded sample and print the result."""
    print("── Self-test ────────────────────────────")
    result = parse_hsk_html(SAMPLE_HTML)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("─────────────────────────────────────────")


# Uncomment the line below to run the self-test when executing this script directly:
# run_self_test()