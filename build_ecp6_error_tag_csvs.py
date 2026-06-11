from __future__ import annotations

import csv
import re
from pathlib import Path


ROOT = Path(r"C:\Users\USER\OneDrive\Documents\HQ Phonics")
SOURCE = ROOT / "ecp6_words_extract.txt"
WORDS_OUT = ROOT / "ecp6_words_inventory.csv"
ERROR_CODES_OUT = ROOT / "ecp6_error_codes.csv"
TAGS_OUT = ROOT / "ecp6_word_error_tags.csv"


VOWEL_TEAMS = (
    "ai",
    "ay",
    "ea",
    "ee",
    "oa",
    "oe",
    "oo",
    "ou",
    "ow",
    "oi",
    "oy",
    "au",
    "aw",
    "ew",
    "ue",
    "ie",
)
R_CONTROLLED = ("ar", "er", "ir", "or", "ur")
DIGRAPHS = ("sh", "ch", "th", "wh", "ph", "ck", "ng", "nk", "tch")
SIMILAR_CONTRAST_LETTERS = set("bdlrnmfpv")
VOWELS = "aeiouy"


ERROR_CODES = [
    {
        "error_code": "SHORT_VOWEL_SHIFT",
        "chairman_label": "short vowel confusion",
        "abstract_detection_target": "TARGET_SHORT_VOWEL_REALIZED_AS_DIFFERENT_VOWEL_CATEGORY",
        "detection_scope": "pronunciation|reading",
        "dashboard_group": "vowel_errors",
        "surface_error_pattern": "target short vowel is replaced by another vowel sound",
        "ai_detection_note": "Compare realized vowel quality against the expected short-vowel target.",
    },
    {
        "error_code": "SIMILAR_CONSONANT_SHIFT",
        "chairman_label": "similar consonant-pair confusion",
        "abstract_detection_target": "TARGET_CONSONANT_REALIZED_AS_NEARBY_L1_OR_VISUALLY_SIMILAR_CONSONANT",
        "detection_scope": "pronunciation|reading",
        "dashboard_group": "consonant_errors",
        "surface_error_pattern": "target consonant is replaced, blurred, or swapped with a nearby consonant",
        "ai_detection_note": "Track contrast pairs such as b/d, l/r, n/m, p/f, and related substitutions.",
    },
    {
        "error_code": "SCHWA_INSERTION_CLUSTER",
        "chairman_label": "schwa insertion",
        "abstract_detection_target": "EXTRA_VOWEL_INSERTED_INSIDE_CONSONANT_CLUSTER",
        "detection_scope": "pronunciation",
        "dashboard_group": "cluster_errors",
        "surface_error_pattern": "an extra vowel appears between clustered consonants",
        "ai_detection_note": "Detect additional vowel energy peaks inside the target cluster.",
    },
    {
        "error_code": "CLUSTER_MEMBER_DELETION",
        "chairman_label": "blend / cluster distortion",
        "abstract_detection_target": "ONE_CONSONANT_IN_CLUSTER_IS_DROPPED_BLURRED_OR_REORDERED",
        "detection_scope": "pronunciation|reading",
        "dashboard_group": "cluster_errors",
        "surface_error_pattern": "one part of the blend or cluster disappears or weakens",
        "ai_detection_note": "Check whether all target cluster members are realized in sequence.",
    },
    {
        "error_code": "FINAL_CONSONANT_DELETION",
        "chairman_label": "final sound missing",
        "abstract_detection_target": "TARGET_FINAL_CONSONANT_NOT_REALIZED_OR_TOO_WEAK_TO_CONFIRM",
        "detection_scope": "pronunciation|reading",
        "dashboard_group": "coda_errors",
        "surface_error_pattern": "the word ends early without the target final sound",
        "ai_detection_note": "Look for missing release or missing coda segment at word end.",
    },
    {
        "error_code": "FINAL_CLUSTER_REDUCTION",
        "chairman_label": "blend / cluster distortion",
        "abstract_detection_target": "FINAL_CONSONANT_CLUSTER_REDUCED_TO_FEWER_SEGMENTS_THAN_TARGET",
        "detection_scope": "pronunciation|reading",
        "dashboard_group": "cluster_errors",
        "surface_error_pattern": "a final consonant cluster is simplified or partially dropped",
        "ai_detection_note": "Track whether all target final-cluster members are preserved.",
    },
    {
        "error_code": "FINAL_E_RULE_NOT_REALIZED",
        "chairman_label": "CVCe / final-e error",
        "abstract_detection_target": "FINAL_E_PATTERN_FAILS_TO_TRIGGER_EXPECTED_LONG_VOWEL_READING_OR_SPELLING",
        "detection_scope": "reading|spelling",
        "dashboard_group": "pattern_errors",
        "surface_error_pattern": "the final-e pattern is ignored, collapsed, or spelled without final e",
        "ai_detection_note": "Detect loss of long-vowel realization or omission of final e in spelling.",
    },
    {
        "error_code": "VOWEL_TEAM_NOT_REALIZED",
        "chairman_label": "word-family / pattern confusion",
        "abstract_detection_target": "VOWEL_TEAM_PATTERN_SPLIT_OR_REALIZED_WITH_WRONG_VOWEL_VALUE",
        "detection_scope": "reading|spelling",
        "dashboard_group": "pattern_errors",
        "surface_error_pattern": "the vowel team is broken apart or mapped to the wrong sound",
        "ai_detection_note": "Compare the realized vowel output against the expected team pattern.",
    },
    {
        "error_code": "R_CONTROLLED_VOWEL_NOT_REALIZED",
        "chairman_label": "word-family / pattern confusion",
        "abstract_detection_target": "R_CONTROLLED_PATTERN_FAILS_TO_SURFACE_AS_THE_EXPECTED_R_COLORED_VOWEL",
        "detection_scope": "pronunciation|reading|spelling",
        "dashboard_group": "pattern_errors",
        "surface_error_pattern": "the r-controlled vowel is flattened, split, or replaced",
        "ai_detection_note": "Track whether the vowel+r unit stays fused as the target pattern.",
    },
    {
        "error_code": "CONSONANT_DIGRAPH_NOT_REALIZED",
        "chairman_label": "word-family / pattern confusion",
        "abstract_detection_target": "DIGRAPH_IS_READ_AS_SEPARATE_LETTERS_OR_SUBSTITUTED_WITH_A_DIFFERENT_CONSONANT",
        "detection_scope": "pronunciation|reading|spelling",
        "dashboard_group": "pattern_errors",
        "surface_error_pattern": "the digraph is split or replaced with a non-target consonant",
        "ai_detection_note": "Treat the digraph as one target unit and verify that unit is preserved.",
    },
    {
        "error_code": "PHONEME_COUNT_MISMATCH",
        "chairman_label": "segmentation weakness",
        "abstract_detection_target": "REALIZED_SOUND_COUNT_DOES_NOT_MATCH_THE_EXPECTED_PHONEME_STRUCTURE",
        "detection_scope": "pronunciation|reading|segmentation_task",
        "dashboard_group": "segmentation_errors",
        "surface_error_pattern": "the student expands, compresses, or miscounts the word's sound structure",
        "ai_detection_note": "Useful for Elkonin-box tasks, sound counting, and syllable/phoneme mismatch flags.",
    },
    {
        "error_code": "INCOMPLETE_SOUND_CHAIN",
        "chairman_label": "blending weakness",
        "abstract_detection_target": "TARGET_SOUND_SEQUENCE_IS_NOT_HELD_TOGETHER_AS_ONE_CONTINUOUS_DECODING_CHAIN",
        "detection_scope": "reading|pronunciation",
        "dashboard_group": "blending_errors",
        "surface_error_pattern": "the student breaks, stalls, or loses part of the target sound chain",
        "ai_detection_note": "Track pauses, resets, and dropped early sounds during connected decoding.",
    },
    {
        "error_code": "ENCODING_PATTERN_BREAKDOWN",
        "chairman_label": "sound-to-spelling / dictation error",
        "abstract_detection_target": "HEARD_SOUND_SEQUENCE_FAILS_TO_MAP_TO_THE_EXPECTED_SPELLING_PATTERN",
        "detection_scope": "spelling|dictation",
        "dashboard_group": "encoding_errors",
        "surface_error_pattern": "the student captures only part of the sound sequence or chooses the wrong pattern in spelling",
        "ai_detection_note": "Useful for dictation, drag-build, and typing tasks tied to the target word.",
    },
]


def parse_words() -> list[str]:
    lines = [line.strip() for line in SOURCE.read_text(encoding="utf-8").splitlines()]
    return [
        line
        for line in lines
        if line and line not in {"===== SHEET: Word List =====", "Word"}
    ]


def normalize(word: str) -> str:
    return re.sub(r"[^a-z]", "", word.lower())


def raw_vowel_group_count(clean: str) -> int:
    return len(re.findall(r"[aeiouy]+", clean))


def has_silent_e(clean: str) -> bool:
    return len(clean) >= 3 and clean.endswith("e") and not clean.endswith("le") and clean[-2] not in VOWELS


def pronounced_vowel_group_count(clean: str) -> int:
    count = raw_vowel_group_count(clean)
    if has_silent_e(clean) and count > 1:
        count -= 1
    return max(count, 1 if clean else 0)


def has_onset_cluster(clean: str) -> bool:
    match = re.match(r"^([^aeiouy]+)", clean)
    return bool(match and len(match.group(1)) >= 2)


def has_final_cluster(clean: str) -> bool:
    match = re.search(r"([^aeiouy]+)$", clean)
    return bool(match and len(match.group(1)) >= 2)


def ends_with_consonant(clean: str) -> bool:
    return bool(clean) and clean[-1] not in VOWELS


def has_cvc_e(clean: str) -> bool:
    return bool(re.search(r"[^aeiouy][aeiou][^aeiouy]e$", clean))


def find_vowel_teams(clean: str) -> list[str]:
    return [team for team in VOWEL_TEAMS if team in clean]


def find_r_controlled(clean: str) -> list[str]:
    matches: list[str] = []
    for pattern in R_CONTROLLED:
        for match in re.finditer(pattern, clean):
            start = match.start()
            if start == 0 or clean[start - 1] not in VOWELS:
                matches.append(pattern)
                break
    return matches


def find_digraphs(clean: str) -> list[str]:
    return [pattern for pattern in DIGRAPHS if pattern in clean]


def has_short_vowel_risk(clean: str) -> bool:
    if not clean or has_cvc_e(clean) or find_vowel_teams(clean) or find_r_controlled(clean):
        return False
    if pronounced_vowel_group_count(clean) != 1:
        return False
    return any(vowel in clean for vowel in "aeiou")


def consonant_contrast_letters(clean: str) -> list[str]:
    return sorted({letter for letter in clean if letter in SIMILAR_CONTRAST_LETTERS})


def syllable_profile(clean: str) -> str:
    groups = pronounced_vowel_group_count(clean)
    if groups <= 1 and len(clean) <= 6:
        return "single_syllable_like"
    if groups == 2:
        return "two_syllable_like"
    return "multisyllable_like"


def build_feature_flags(clean: str) -> list[str]:
    flags: list[str] = []
    if has_onset_cluster(clean):
        flags.append("onset_cluster")
    if has_final_cluster(clean):
        flags.append("final_cluster")
    if ends_with_consonant(clean):
        flags.append("final_consonant")
    if has_cvc_e(clean):
        flags.append("cvc_e")
    if find_vowel_teams(clean):
        flags.append("vowel_team")
    if find_r_controlled(clean):
        flags.append("r_controlled")
    if find_digraphs(clean):
        flags.append("digraph")
    if has_short_vowel_risk(clean):
        flags.append("short_vowel_like")
    if consonant_contrast_letters(clean):
        flags.append("contrast_letter")
    if pronounced_vowel_group_count(clean) >= 2 or len(clean) >= 7:
        flags.append("longer_word")
    return flags


def add_tag(rows: list[dict[str, str]], word_id: int, word: str, code: str, priority: str, trigger: str) -> None:
    code_info = next(item for item in ERROR_CODES if item["error_code"] == code)
    rows.append(
        {
            "word_id": str(word_id),
            "word": word,
            "error_code": code,
            "chairman_label": code_info["chairman_label"],
            "abstract_detection_target": code_info["abstract_detection_target"],
            "risk_priority": priority,
            "detection_scope": code_info["detection_scope"],
            "feature_trigger": trigger,
            "surface_error_pattern": code_info["surface_error_pattern"],
            "dashboard_group": code_info["dashboard_group"],
        }
    )


def build_word_rows(words: list[str]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for index, word in enumerate(words, start=1):
        clean = normalize(word)
        flags = build_feature_flags(clean)
        rows.append(
            {
                "word_id": str(index),
                "word": word,
                "normalized_word": clean,
                "char_length": str(len(clean)),
                "vowel_group_count": str(pronounced_vowel_group_count(clean)),
                "syllable_profile": syllable_profile(clean),
                "feature_flags": "|".join(flags),
            }
        )
    return rows


def build_tag_rows(words: list[str]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for index, word in enumerate(words, start=1):
        clean = normalize(word)
        teams = find_vowel_teams(clean)
        r_patterns = find_r_controlled(clean)
        digraphs = find_digraphs(clean)
        contrast_letters = consonant_contrast_letters(clean)

        if has_onset_cluster(clean):
            add_tag(rows, index, word, "SCHWA_INSERTION_CLUSTER", "high", "onset_cluster")
            add_tag(rows, index, word, "CLUSTER_MEMBER_DELETION", "high", "onset_cluster")
            add_tag(rows, index, word, "PHONEME_COUNT_MISMATCH", "medium", "onset_cluster")
            add_tag(rows, index, word, "INCOMPLETE_SOUND_CHAIN", "medium", "onset_cluster")

        if has_final_cluster(clean):
            add_tag(rows, index, word, "FINAL_CLUSTER_REDUCTION", "high", "final_cluster")
            add_tag(rows, index, word, "PHONEME_COUNT_MISMATCH", "medium", "final_cluster")

        if ends_with_consonant(clean):
            add_tag(rows, index, word, "FINAL_CONSONANT_DELETION", "medium", "final_consonant")

        if has_cvc_e(clean):
            add_tag(rows, index, word, "FINAL_E_RULE_NOT_REALIZED", "high", "cvc_e")
            add_tag(rows, index, word, "ENCODING_PATTERN_BREAKDOWN", "medium", "cvc_e")

        if teams:
            add_tag(rows, index, word, "VOWEL_TEAM_NOT_REALIZED", "high", f"vowel_team:{'|'.join(teams)}")
            add_tag(rows, index, word, "ENCODING_PATTERN_BREAKDOWN", "medium", f"vowel_team:{'|'.join(teams)}")

        if r_patterns:
            add_tag(rows, index, word, "R_CONTROLLED_VOWEL_NOT_REALIZED", "high", f"r_controlled:{'|'.join(r_patterns)}")
            add_tag(rows, index, word, "ENCODING_PATTERN_BREAKDOWN", "medium", f"r_controlled:{'|'.join(r_patterns)}")

        if digraphs:
            add_tag(rows, index, word, "CONSONANT_DIGRAPH_NOT_REALIZED", "medium", f"digraph:{'|'.join(digraphs)}")

        if has_short_vowel_risk(clean):
            add_tag(rows, index, word, "SHORT_VOWEL_SHIFT", "medium", "short_vowel_like")

        if contrast_letters:
            add_tag(rows, index, word, "SIMILAR_CONSONANT_SHIFT", "medium", f"contrast_letter:{'|'.join(contrast_letters)}")

        if pronounced_vowel_group_count(clean) >= 2 or len(clean) >= 7:
            add_tag(rows, index, word, "PHONEME_COUNT_MISMATCH", "low", "longer_word")
            add_tag(rows, index, word, "INCOMPLETE_SOUND_CHAIN", "low", "longer_word")
            add_tag(rows, index, word, "ENCODING_PATTERN_BREAKDOWN", "medium", "longer_word")

    return collapse_duplicate_tags(rows)


def collapse_duplicate_tags(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    priority_rank = {"low": 1, "medium": 2, "high": 3}
    collapsed: dict[tuple[str, str], dict[str, str]] = {}

    for row in rows:
        key = (row["word_id"], row["error_code"])
        existing = collapsed.get(key)
        if not existing:
            collapsed[key] = row.copy()
            continue

        existing_triggers = set(filter(None, existing["feature_trigger"].split("|")))
        new_triggers = set(filter(None, row["feature_trigger"].split("|")))
        merged_triggers = sorted(existing_triggers | new_triggers)
        existing["feature_trigger"] = "|".join(merged_triggers)

        if priority_rank[row["risk_priority"]] > priority_rank[existing["risk_priority"]]:
            existing["risk_priority"] = row["risk_priority"]

    return list(collapsed.values())


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    if not rows:
        return
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    words = parse_words()
    word_rows = build_word_rows(words)
    tag_rows = build_tag_rows(words)
    write_csv(WORDS_OUT, word_rows)
    write_csv(ERROR_CODES_OUT, ERROR_CODES)
    write_csv(TAGS_OUT, tag_rows)
    print(f"Wrote {WORDS_OUT.name} ({len(word_rows)} rows)")
    print(f"Wrote {ERROR_CODES_OUT.name} ({len(ERROR_CODES)} rows)")
    print(f"Wrote {TAGS_OUT.name} ({len(tag_rows)} rows)")


if __name__ == "__main__":
    main()
