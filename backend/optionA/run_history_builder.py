# optionA/run_history_builder.py
from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

def _cv(values: List[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    if mean == 0:
        return 0.0
    var = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return (var**0.5) / mean
class _KmSegStat:
    def __init__(self, start_m: int, end_m: int):
        self.start_m = start_m
        self.end_m   = end_m
        self.paces: List[float] = []
        self.hrs:   List[int]   = []

    def add(self, pace: float, hr: Optional[int]) -> None:
        self.paces.append(pace)
        if hr is not None:
            self.hrs.append(hr)

    def to_json(self) -> dict | None:
        if not self.paces:
            return None
        return {
            "start_m":  self.start_m,
            "end_m":    self.end_m,
            "avg_pace": sum(self.paces) / len(self.paces),
            "avg_hr":   sum(self.hrs) / len(self.hrs) if self.hrs else None,
        }
class _KmStat:
    def __init__(self, km_idx: int, seg_len: int):
        self.km_idx = km_idx
        self.seg_len = seg_len
        self.paces: List[float] = []
        self.hrs:   List[int]   = []
        self.segments = [
            _KmSegStat(i, i + seg_len) for i in range(0, 1000, seg_len)
        ]

    def add(self, dist_m: float, pace: float, hr: Optional[int]) -> None:
        self.paces.append(pace)
        if hr is not None:
            self.hrs.append(hr)

        seg_idx = min(int(dist_m // self.seg_len), len(self.segments) - 1)
        self.segments[seg_idx].add(pace, hr)

    def to_json(self) -> dict | None:
        if not self.paces:
            return None

        segs = [
            s_json for s in self.segments if (s_json := s.to_json())
        ]
        return {
            "km":        self.km_idx,
            "avg_pace":  sum(self.paces) / len(self.paces),
            "cv_pace":   _cv(self.paces),
            "avg_hr":    sum(self.hrs) / len(self.hrs) if self.hrs else None,
            "segments":  segs,
        }
class RunHistoryBuilder:
    def __init__(self, seg_len_m: int = 100, autosave: bool = False):
        self.seg_len  = seg_len_m
        self.autosave = autosave
        self.km_stats: List[_KmStat] = []

        base = Path(__file__).resolve().parent / "logs"
        base.mkdir(exist_ok=True)
        self.out_path = base / "run_history.json"

    def _current_km(self) -> _KmStat:
        if not self.km_stats:
            self.km_stats.append(_KmStat(1, self.seg_len))
        return self.km_stats[-1]

    def add_sample(self, *, dist_m: float, pace: float, hr: Optional[int]) -> None:
        while dist_m >= self._current_km().km_idx * 1000:
            self.km_stats.append(
                _KmStat(self._current_km().km_idx + 1, self.seg_len)
            )
        self._current_km().add(dist_m % 1000, pace, hr)

        if self.autosave:
            self.save_json(self.out_path)

    def save_json(self, path: str | Path | None = None) -> None:
        path = Path(path or self.out_path)
        data = [
            km_json
            for km in self.km_stats
            if (km_json := km.to_json()) is not None
        ]
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
