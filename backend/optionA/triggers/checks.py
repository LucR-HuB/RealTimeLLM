from math import floor
from ..route_api import CoachIn   

_last_km = -1

def is_new_km(data: CoachIn) -> bool:
    """
    Déclenché quand on vient de passer un km entier.
    """
    global _last_km
    km_now = floor(data.done_km)
    if km_now > _last_km:
        _last_km = km_now
        return True
    return False


def pace_too_slow(data: CoachIn, thresh: float = 0.20) -> bool:
    """
    Pace réel supérieur de > thresh (min/km) à l’objectif.
    """
    return data.pace_gap > thresh