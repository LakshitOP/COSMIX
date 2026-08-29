import math
import sys
from pathlib import Path
from typing import List

# Ensure backend directory is in sys.path
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.models.schemas import SatelliteRecord

# Constants for Astrodynamics
MU_EARTH = 398600.4418  # Earth's gravitational parameter (km^3/s^2)
EARTH_RADIUS_KM = 6378.137


def parse_scientific_notation(val_str: str) -> float:
    """Parses TLE scientific notation (e.g., ' 30122-3' -> 0.00030122)."""
    val_str = val_str.strip()
    if not val_str or val_str == "00000-0" or val_str == "00000+0":
        return 0.0

    sign = -1.0 if val_str.startswith('-') else 1.0
    val_str = val_str.lstrip('+- ')

    if '-' in val_str:
        mantissa, exp = val_str.split('-', 1)
        exp = -int(exp.strip())
    elif '+' in val_str:
        mantissa, exp = val_str.split('+', 1)
        exp = int(exp.strip())
    else:
        return float(val_str)

    mantissa = mantissa.strip()
    return sign * float(f"0.{mantissa}") * (10 ** exp)


_WELL_KNOWN_NAMES: dict[int, str] = {
    25544: "ISS (ZARYA)",
    36086: "POISK (ISS)",
    48274: "CSS (TIANHE)",
    49044: "ISS (NAUKA)",
    53239: "CSS (WENTIAN)",
    54216: "CSS (MENGTIAN)",
    66052: "HRC MONOBLOCK CAMERA",
    66515: "SZ-21 MODULE",
    66906: "DUPLEX",
    20580: "HUBBLE SPACE TELESCOPE",
    28485: "SWIFT",
    25338: "NOAA 15",
    28654: "NOAA 18",
    33591: "NOAA 19",
    29677: "FENGYUN 1C DEB",
    33500: "COSMOS 2251 DEB",
    33783: "IRIDIUM 33 DEB",
    49700: "COSMOS 1408 DEB",
    19650: "SL-16 R/B (STAGE)",
    6073: "DELTA 1 DEB",
    4383: "SL-3 R/B",
    44540: "CZ-4B DEB",
    24320: "PEGASUS DEB",
    1650: "TITAN 3C TRANSTAGE",
    50: "THOR ABLE DEB",
    38750: "BREEZE-M DEB",
}

_NAME_INDEX: dict[int, str] = {}


def _get_name_index() -> dict[int, str]:
    global _NAME_INDEX
    if not _NAME_INDEX:
        _NAME_INDEX.update(_WELL_KNOWN_NAMES)
        cache_dir = Path(__file__).resolve().parent / "cache"
        if cache_dir.exists():
            for p in cache_dir.glob("*.txt"):
                try:
                    txt = p.read_text(encoding="utf-8")
                    lines = [l.strip() for l in txt.splitlines() if l.strip()]
                    i = 0
                    while i < len(lines):
                        if lines[i].startswith("1 ") and i + 1 < len(lines) and lines[i + 1].startswith("2 "):
                            i += 2
                        elif i + 2 < len(lines) and lines[i + 1].startswith("1 ") and lines[i + 2].startswith("2 "):
                            try:
                                nid = int(lines[i + 1][2:7].strip())
                                s_name = lines[i].strip()
                                if s_name and not s_name.startswith("1 ") and not s_name.startswith("2 ") and not s_name.startswith("OBJECT_"):
                                    _NAME_INDEX[nid] = s_name
                            except ValueError:
                                pass
                            i += 3
                        else:
                            i += 1
                except Exception:
                    pass
    return _NAME_INDEX


def parse_tle_catalog(raw_text: str) -> List[SatelliteRecord]:
    """Converts a raw multi-line TLE string into a list of validated SatelliteRecords."""
    name_map = _get_name_index()
    lines = [line.strip() for line in raw_text.strip().splitlines() if line.strip()]
    records = []
    i = 0

    while i < len(lines):
        name = "UNKNOWN"
        try:
            # Handle 2-line or 3-line format
            if lines[i].startswith("1 ") and i + 1 < len(lines) and lines[i + 1].startswith("2 "):
                norad_id = int(lines[i][2:7].strip())
                name = name_map.get(norad_id) or f"SAT-{norad_id}"
                l1, l2 = lines[i], lines[i + 1]
                i += 2
            elif i + 2 < len(lines) and lines[i + 1].startswith("1 ") and lines[i + 2].startswith("2 "):
                norad_id = int(lines[i + 1][2:7].strip())
                candidate_name = lines[i].strip()
                if candidate_name and not candidate_name.startswith("1 ") and not candidate_name.startswith("2 ") and not candidate_name.startswith("OBJECT_"):
                    name = candidate_name
                else:
                    name = name_map.get(norad_id) or f"SAT-{norad_id}"
                l1, l2 = lines[i + 1], lines[i + 2]
                i += 3
            else:
                i += 1
                continue

            desig = l1[9:17].strip()
            if not name or name.startswith("SAT-"):
                if desig.startswith("99025"):
                    name = f"FENGYUN 1C DEB ({norad_id})"
                elif desig.startswith("93036"):
                    name = f"COSMOS 2251 DEB ({norad_id})"
                elif desig.startswith("97051"):
                    name = f"IRIDIUM 33 DEB ({norad_id})"
                elif desig.startswith("98067"):
                    name = name_map.get(norad_id) or f"ISS COMPONENT ({norad_id})"
                elif desig.startswith("90037"):
                    name = "HUBBLE SPACE TELESCOPE"
                elif desig.startswith("21035"):
                    name = name_map.get(norad_id) or f"TIANGONG MODULE ({norad_id})"

            inclination = float(l2[8:16].strip())
            eccentricity = float(f"0.{l2[26:33].strip()}" if l2[26:33].strip() else "0")
            mean_motion_rev_day = float(l2[52:63].strip())
            if abs(mean_motion_rev_day) < 1e-12:
                raise ZeroDivisionError("mean_motion_rev_day is zero")

            bstar_str = l1[53:61].strip()
            bstar = parse_scientific_notation(bstar_str)

            # Compute semi-major axis (a), perigee, and apogee using Kepler's 3rd Law
            n_rad_s = mean_motion_rev_day * (2 * math.pi / 86400.0)
            a_km = (MU_EARTH / (n_rad_s ** 2)) ** (1.0 / 3.0)

            perigee_km = a_km * (1.0 - eccentricity) - EARTH_RADIUS_KM
            apogee_km = a_km * (1.0 + eccentricity) - EARTH_RADIUS_KM

            records.append(
                SatelliteRecord(
                    norad_id=norad_id,
                    name=name,
                    line1=l1,
                    line2=l2,
                    apogee_km=apogee_km,
                    perigee_km=perigee_km,
                    inclination_deg=inclination,
                    bstar_drag=bstar,
                )
            )
        except (ValueError, TypeError, IndexError, ZeroDivisionError) as exc:
            print(f"[PARSER ERROR] {name}: {exc}")
            continue

    return records