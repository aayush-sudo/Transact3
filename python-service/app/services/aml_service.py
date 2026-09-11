"""
Fuzzy-Matching RegTech AML & Sanction Screening Microservice.
Combines:
1. Jaro-Winkler string similarity
2. Levenshtein edit distance ratio
3. Soundex phonetic encoding
Against US Treasury OFAC Specially Designated Nationals (SDN) and UN Sanction Lists.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional

try:
    import jellyfish
except ImportError:
    jellyfish = None

# Curated OFAC SDN & UN Sanction benchmark database entities
BENCHMARK_SANCTIONED_ENTITIES = [
    "VLADIMIR PETROV",
    "SERGEI IVANOV",
    "MIKHAIL BOGDANOV",
    "DMITRY VOLKOV",
    "VIKTOR BOUT",
    "ALEXANDER LUKASHENKO",
    "KIM JONG UN",
    "BASHAR AL ASSAD",
    "QASEM SOLEIMANI",
    "AYMAN AL ZAWAHIRI",
    "HASSAN NASRALLAH",
    "ALI KHAMENEI",
    "NICOLAS MADURO",
    "TARECK EL AISSAMI",
    "ISMAIL HANIYEH",
    "YAHYA SINWAR",
    "MOHAMMAD DEIF",
    "ABU BAKR AL BAGHDADI",
    "OSAMA BIN LADEN",
    "ILHAM ALIYEV"
]

@dataclass
class AMLCheckResult:
    query_name: str
    matched_target: str
    risk_score: float
    decision: str  # 'PASS', 'MANUAL_REVIEW', 'REJECT'
    metrics: Dict[str, float]

class AMLSanctionEngine:
    def __init__(self, sanctioned_entities: Optional[List[str]] = None):
        self.sanctioned_list = sanctioned_entities or BENCHMARK_SANCTIONED_ENTITIES

    def _pure_soundex(self, s: str) -> str:
        """Pure Python fallback for American Soundex with W/V phonetic transliteration."""
        s = (s or "").upper().replace("W", "V")
        clean = [c for c in s if c.isalpha()]
        if not clean:
            return "0000"
        first = clean[0]
        mapping = {
            'B': '1', 'F': '1', 'P': '1', 'V': '1',
            'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
            'D': '3', 'T': '3',
            'L': '4',
            'M': '5', 'N': '5',
            'R': '6'
        }
        coded = [first]
        prev = mapping.get(first, '0')
        for c in clean[1:]:
            code = mapping.get(c, '0')
            if code != '0' and code != prev:
                coded.append(code)
            prev = code
        out = ''.join(coded)
        return (out + "000")[:4]

    def _pure_levenshtein(self, s1: str, s2: str) -> int:
        """Pure Python fallback for Levenshtein edit distance."""
        if len(s1) < len(s2):
            return self._pure_levenshtein(s2, s1)
        if len(s2) == 0:
            return len(s1)
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        return previous_row[-1]

    def _pure_jaro_winkler(self, s1: str, s2: str) -> float:
        """Pure Python Jaro-Winkler similarity."""
        if s1 == s2:
            return 1.0
        len1, len2 = len(s1), len(s2)
        if len1 == 0 or len2 == 0:
            return 0.0
        match_bound = max(len1, len2) // 2 - 1
        matches1 = [False] * len1
        matches2 = [False] * len2
        matches = 0
        for i in range(len1):
            start = max(0, i - match_bound)
            end = min(i + match_bound + 1, len2)
            for j in range(start, end):
                if matches2[j]:
                    continue
                if s1[i] == s2[j]:
                    matches1[i] = True
                    matches2[j] = True
                    matches += 1
                    break
        if matches == 0:
            return 0.0
        t = 0
        k = 0
        for i in range(len1):
            if not matches1[i]:
                continue
            while not matches2[k]:
                k += 1
            if s1[i] != s2[k]:
                t += 1
            k += 1
        t //= 2
        jaro = (matches / len1 + matches / len2 + (matches - t) / matches) / 3.0
        prefix = 0
        for i in range(min(4, min(len1, len2))):
            if s1[i] == s2[i]:
                prefix += 1
            else:
                break
        return jaro + prefix * 0.1 * (1.0 - jaro)

    def screen_name(self, input_name: str, threshold_reject: float = 0.85, threshold_review: float = 0.65) -> AMLCheckResult:
        normalized_input = (input_name or "").strip().upper()
        if not normalized_input:
            return AMLCheckResult(
                query_name="",
                matched_target="",
                risk_score=0.0,
                decision="PASS",
                metrics={"jaro_winkler": 0.0, "levenshtein_ratio": 1.0, "soundex_match": 0.0}
            )

        max_score = 0.0
        best_match = ""
        best_metrics = {}

        for entity in self.sanctioned_list:
            normalized_entity = entity.strip().upper()

            # 1. Jaro-Winkler
            if jellyfish:
                jw_score = jellyfish.jaro_winkler_similarity(normalized_input, normalized_entity)
                lev_dist = jellyfish.levenshtein_distance(normalized_input, normalized_entity)
                soundex_input = jellyfish.soundex(normalized_input)
                soundex_entity = jellyfish.soundex(normalized_entity)
            else:
                jw_score = self._pure_jaro_winkler(normalized_input, normalized_entity)
                lev_dist = self._pure_levenshtein(normalized_input, normalized_entity)
                soundex_input = self._pure_soundex(normalized_input)
                soundex_entity = self._pure_soundex(normalized_entity)

            # 2. Normalized Levenshtein ratio
            max_len = max(len(normalized_input), len(normalized_entity))
            lev_ratio = 1.0 - (lev_dist / max_len) if max_len > 0 else 1.0

            # 3. Soundex phonetic comparison
            soundex_match = 1.0 if soundex_input == soundex_entity else 0.0

            # Composite Weighted Risk Score: 50% JW + 35% Levenshtein + 15% Soundex
            composite_score = (0.50 * jw_score) + (0.35 * lev_ratio) + (0.15 * soundex_match)

            if composite_score > max_score:
                max_score = composite_score
                best_match = entity
                best_metrics = {
                    "jaro_winkler": round(jw_score, 4),
                    "levenshtein_ratio": round(lev_ratio, 4),
                    "soundex_match": soundex_match,
                    "soundex_code": soundex_input
                }

        final_risk = round(max_score, 4)
        if final_risk >= threshold_reject:
            decision = "REJECT"
        elif final_risk >= threshold_review:
            decision = "MANUAL_REVIEW"
        else:
            decision = "PASS"

        return AMLCheckResult(
            query_name=input_name,
            matched_target=best_match,
            risk_score=final_risk,
            decision=decision,
            metrics=best_metrics
        )

# Global Singleton
aml_sanction_engine = AMLSanctionEngine()
