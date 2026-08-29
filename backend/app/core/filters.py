import numpy as np
from scipy.spatial import cKDTree
from typing import List, Tuple, Set
from app.models.schemas import SatelliteRecord

def filter_apogee_perigee(
    satellites: List[SatelliteRecord], 
    altitude_buffer_km: float = 25.0
) -> List[Tuple[int, int]]:
    """
    Stage 1: Optimal 1D Sweep-and-Prune Altitude Filter.
    
    Time Complexity: O(N log N + K) where N = satellites, K = candidate pairs.
    Space Complexity: O(N)
    
    Filters out any satellite pairs whose altitude shells do not intersect.
    """
    n = len(satellites)
    if n < 2:
        return []

    # 1. Sort indexed satellites by perigee ascending: O(N log N)
    sorted_items = sorted(
        enumerate(satellites), 
        key=lambda item: item[1].perigee_km
    )

    candidate_pairs: List[Tuple[int, int]] = []

    # 2. Sweep across the sorted array: O(N + K)
    for i in range(n):
        orig_idx_a, sat_a = sorted_items[i]
        reach_max = sat_a.apogee_km + altitude_buffer_km

        for j in range(i + 1, n):
            orig_idx_b, sat_b = sorted_items[j]

            # Early Exit: Because the list is sorted by perigee, if sat_b's lowest point 
            # exceeds sat_a's highest point + buffer, no subsequent satellite can overlap either.
            if sat_b.perigee_km - altitude_buffer_km > sat_a.apogee_km:
                break

            # Overlap Condition: Check if sat_b's apogee reaches sat_a's perigee
            if sat_b.apogee_km + altitude_buffer_km >= sat_a.perigee_km:
                # Ensure ordered index tuple (min_idx, max_idx)
                pair = (min(orig_idx_a, orig_idx_b), max(orig_idx_a, orig_idx_b))
                candidate_pairs.append(pair)

    return candidate_pairs


def query_spatial_proximity(
    positions_eci: np.ndarray, 
    proximity_threshold_km: float = 50.0
) -> List[Tuple[int, int]]:
    """
    Stage 2: 3D K-d Tree Spatial Partitioning.
    
    Time Complexity: O(N log N) build + O(N log N + K) range query.
    Space Complexity: O(N)
    
    Finds all satellite index pairs within proximity_threshold_km in 3D ECI space.
    :param positions_eci: (N, 3) numpy array of [X, Y, Z] coordinates in kilometers.
    """
    if len(positions_eci) < 2:
        return []

    # Build 3D K-d Tree (implemented in C via scipy for maximum speed)
    tree = cKDTree(positions_eci)

    # query_pairs computes all unordered pairs (i, j) with Euclidean distance <= r
    pairs_set: Set[Tuple[int, int]] = tree.query_pairs(r=proximity_threshold_km)
    
    return list(pairs_set)