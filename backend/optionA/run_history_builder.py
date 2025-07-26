from dataclasses import dataclass, field
from typing import List, Optional
from pathlib import Path
import json, math, pandas as pd

@dataclass
class _SegStat:
    start_m: int
    end_m:   int
    paces:   List[float] = field(default_factory=list)
    hrs:     List[int]   = field(default_factory=list)

    def add(self, pace: float, hr: Optional[int]):
        self.paces.append(pace)
        if hr is not None:
            self.hrs.append(hr)

    def to_json(self):
        return {
            "start_m": self.start_m,
            "end_m":   self.end_m,
            "avg_pace": sum(self.paces) / len(self.paces),
            "avg_hr":   (sum(self.hrs) / len(self.hrs)) if self.hrs else None,
        }

@dataclass
class _KmStat:
    km_idx: int
    seg_len: int = 100
    segments: List[_SegStat] = field(default_factory=list)

    def _current_seg(self):
        if not self.segments:
            self.segments.append(_SegStat(0, self.seg_len))
        return self.segments[-1]

    def add(self, dist_m: float, pace: float, hr: Optional[int]):
        while dist_m >= self._current_seg().end_m:
            nxt_end = self._current_seg().end_m + self.seg_len
            self.segments.append(_SegStat(self._current_seg().end_m, nxt_end))
        self._current_seg().add(pace, hr)

    def to_json(self):
        paces = [p for seg in self.segments for p in seg.paces]
        cv = 0
        if len(paces) > 1:
            cv = pd.Series(paces).std(ddof=1) / (sum(paces) / len(paces))
        hrs = [h for seg in self.segments for h in seg.hrs]
        return {
            "km":       self.km_idx,
            "avg_pace": sum(paces) / len(paces),
            "cv_pace":  cv,
            "avg_hr":   (sum(hrs) / len(hrs)) if hrs else None,
            "segments": [seg.to_json() for seg in self.segments],
        }

class RunHistoryBuilder:
    def __init__(self, seg_len_m: int = 100, autosave: bool = False):
        self.seg_len   = seg_len_m
        self.autosave  = autosave
        self.km_stats: List[_KmStat] = []
        # chemin fixe backend/optionA/logs/run_history.json
        base = Path(__file__).resolve().parent / "logs"
        base.mkdir(exist_ok=True)
        self.out_path = base / "run_history.json"

    def _current_km(self):
        if not self.km_stats:
            self.km_stats.append(_KmStat(1, self.seg_len))
        return self.km_stats[-1]

    def add_sample(self, *, dist_m: float, pace: float, hr: Optional[int]):
        while dist_m >= self._current_km().km_idx * 1000:
            self.km_stats.append(_KmStat(self._current_km().km_idx + 1, self.seg_len))
        self._current_km().add(dist_m % 1000, pace, hr)
        if self.autosave:
            self.save_json(self.out_path)

    def save_json(self, path: str | Path = None):
        path = path or self.out_path
        data = [km.to_json() for km in self.km_stats if km.segments]
        Path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False))
        print("Historique sauvegardé →", Path(path).resolve())