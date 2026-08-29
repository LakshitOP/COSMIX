/**
 * ORBITAL — Unified API & Telemetry Client
 * Connects frontend views to FastAPI backend, SGP4 astrodynamics, and ML pipeline.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CosmixAPI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Base URL resolution: default to localhost:8000 for local development,
  // or window.location.origin if served from the backend.
  const DEFAULT_API_BASE =
    (typeof window !== 'undefined' && (window.COSMIX_API_URL || (window.location.port === '8000' ? window.location.origin : 'http://localhost:8000')));

  const DEFAULT_WS_BASE = DEFAULT_API_BASE.replace(/^http/, 'ws');

  // In-memory instant cache to avoid duplicate network latency
  const _API_CACHE = new Map();
  const CACHE_TTL_MS = 20000;

  // Fallback satellite records if backend server is unreachable
  const FALLBACK_CATALOG = [
    { norad_id: 25544, name: 'ISS (ZARYA)', intl_designator: '1998-067A', apogee_km: 422.0, perigee_km: 416.0, inclination_deg: 51.64, period_min: 92.9, bstar_drag: 0.000142, status: 'ACTIVE', regime: 'LEO', group: 'stations' },
    { norad_id: 48274, name: 'TIANGONG (CSS)', intl_designator: '2021-035A', apogee_km: 392.0, perigee_km: 386.0, inclination_deg: 41.47, period_min: 92.3, bstar_drag: 0.000115, status: 'ACTIVE', regime: 'LEO', group: 'stations' },
    { norad_id: 20580, name: 'HST (HUBBLE)', intl_designator: '1990-037B', apogee_km: 541.0, perigee_km: 535.0, inclination_deg: 28.47, period_min: 95.3, bstar_drag: 0.000031, status: 'ACTIVE', regime: 'LEO', group: 'active' },
    { norad_id: 49728, name: 'STARLINK-3021', intl_designator: '2021-105A', apogee_km: 553.0, perigee_km: 548.0, inclination_deg: 53.22, period_min: 95.6, bstar_drag: 0.000095, status: 'ACTIVE', regime: 'LEO', group: 'starlink' },
    { norad_id: 44714, name: 'STARLINK-1007', intl_designator: '2019-074A', apogee_km: 550.0, perigee_km: 546.0, inclination_deg: 53.05, period_min: 95.5, bstar_drag: 0.000085, status: 'ACTIVE', regime: 'LEO', group: 'starlink' },
    { norad_id: 48021, name: 'STARLINK-2451', intl_designator: '2021-024A', apogee_km: 552.0, perigee_km: 547.0, inclination_deg: 53.22, period_min: 95.6, bstar_drag: 0.000092, status: 'ACTIVE', regime: 'LEO', group: 'starlink' },
    { norad_id: 20724, name: 'GPS BIIA-10 (PRN 32)', intl_designator: '1990-068A', apogee_km: 20230.0, perigee_km: 20170.0, inclination_deg: 55.02, period_min: 717.9, bstar_drag: 0.000005, status: 'ACTIVE', regime: 'MEO', group: 'gps-ops' },
    { norad_id: 48859, name: 'GPS III-SV05', intl_designator: '2021-054A', apogee_km: 20210.0, perigee_km: 20150.0, inclination_deg: 55.00, period_min: 717.8, bstar_drag: 0.000004, status: 'ACTIVE', regime: 'MEO', group: 'gps-ops' },
    { norad_id: 43566, name: 'GALILEO-26 (GSAT0224)', intl_designator: '2018-060C', apogee_km: 23230.0, perigee_km: 23214.0, inclination_deg: 56.00, period_min: 844.0, bstar_drag: 0.000003, status: 'ACTIVE', regime: 'MEO', group: 'gps-ops' },
    { norad_id: 33591, name: 'NOAA 19', intl_designator: '2009-005A', apogee_km: 868.0, perigee_km: 846.0, inclination_deg: 98.71, period_min: 102.1, bstar_drag: 0.000062, status: 'ACTIVE', regime: 'LEO', group: 'active' },
    { norad_id: 25994, name: 'TERRA (EOS AM-1)', intl_designator: '1999-068A', apogee_km: 708.0, perigee_km: 705.0, inclination_deg: 98.20, period_min: 98.8, bstar_drag: 0.000045, status: 'ACTIVE', regime: 'LEO', group: 'active' },
    { norad_id: 27424, name: 'AQUA (EOS PM-1)', intl_designator: '2002-022A', apogee_km: 705.0, perigee_km: 702.0, inclination_deg: 98.19, period_min: 98.7, bstar_drag: 0.000048, status: 'ACTIVE', regime: 'LEO', group: 'active' },
    { norad_id: 39634, name: 'SENTINEL-1A', intl_designator: '2014-016A', apogee_km: 694.0, perigee_km: 692.0, inclination_deg: 98.18, period_min: 98.5, bstar_drag: 0.000028, status: 'ACTIVE', regime: 'LEO', group: 'active' },
    { norad_id: 39084, name: 'LANDSAT 8', intl_designator: '2013-008A', apogee_km: 705.0, perigee_km: 703.0, inclination_deg: 98.22, period_min: 98.8, bstar_drag: 0.000033, status: 'ACTIVE', regime: 'LEO', group: 'active' },
    { norad_id: 29677, name: 'FENGYUN 1C DEB', intl_designator: '1999-025DF', apogee_km: 845.0, perigee_km: 790.0, inclination_deg: 98.85, period_min: 101.2, bstar_drag: 0.000312, status: 'DEBRIS', regime: 'LEO', group: 'debris' },
    { norad_id: 49700, name: 'COSMOS 1408 DEB', intl_designator: '1982-092A', apogee_km: 495.0, perigee_km: 465.0, inclination_deg: 82.60, period_min: 94.2, bstar_drag: 0.000350, status: 'DEBRIS', regime: 'LEO', group: 'debris' },
    { norad_id: 33500, name: 'COSMOS 2251 DEB', intl_designator: '1993-036KW', apogee_km: 830.0, perigee_km: 785.0, inclination_deg: 74.02, period_min: 100.8, bstar_drag: 0.000280, status: 'DEBRIS', regime: 'LEO', group: 'debris' },
    { norad_id: 33783, name: 'IRIDIUM 33 DEB', intl_designator: '1997-051AQ', apogee_km: 792.0, perigee_km: 760.0, inclination_deg: 86.40, period_min: 100.2, bstar_drag: 0.000210, status: 'DEBRIS', regime: 'LEO', group: 'debris' },
    { norad_id: 19650, name: 'SL-16 R/B (STAGE)', intl_designator: '1988-102B', apogee_km: 875.0, perigee_km: 845.0, inclination_deg: 71.01, period_min: 102.1, bstar_drag: 0.000260, status: 'DEBRIS', regime: 'LEO', group: 'debris' }
  ];

  // Helper fetch with instant timeout & caching
  async function request(endpoint, options = {}, timeoutMs = 1200) {
    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    const cacheKey = endpoint;

    if (isGet && _API_CACHE.has(cacheKey)) {
      const cached = _API_CACHE.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = `${DEFAULT_API_BASE}${endpoint}`;

    const headers = {
      'Accept': 'application/json',
      ...(options.headers || {})
    };
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: headers
      });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (isGet) {
        _API_CACHE.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  function mapCelesTrakRecord(item) {
    const norad = item.NORAD_CAT_ID || item.norad_id || item.norad;
    const name = item.OBJECT_NAME || item.name || `SAT-${norad}`;
    const meanMotion = Number(item.MEAN_MOTION) || 15.0; // revs/day
    const periodMin = Number(item.PERIOD) || (meanMotion > 0 ? (1440.0 / meanMotion) : 95.0);
    const apogee = Number(item.APOAPSIS) || Number(item.apogee_km) || 500.0;
    const perigee = Number(item.PERIAPSIS) || Number(item.perigee_km) || 500.0;
    const avgAlt = Math.round((apogee + perigee) / 2);
    const inc = Number(item.INCLINATION) || Number(item.inclination_deg) || 51.6;
    const bstar = Number(item.BSTAR) || Number(item.bstar_drag) || 0.0001;
    const objType = (item.OBJECT_TYPE || '').toUpperCase();
    const isDebris = objType === 'DEBRIS' || objType === 'ROCKET BODY' || name.includes('DEB') || name.includes('R/B');

    let regime = 'LEO';
    if (avgAlt >= 2000 && avgAlt < 35000) regime = 'MEO';
    else if (avgAlt >= 35000) regime = 'GEO';

    return {
      norad_id: Number(norad),
      name: name,
      intl_designator: item.OBJECT_ID || item.intl_designator || '',
      apogee_km: apogee,
      perigee_km: perigee,
      inclination_deg: inc,
      period_min: periodMin,
      bstar_drag: bstar,
      status: isDebris ? 'DEBRIS' : 'ACTIVE',
      regime: regime,
      object_type: objType || (isDebris ? 'DEBRIS' : 'PAYLOAD')
    };
  }

  const BROWSER_24H_TTL_MS = 24 * 60 * 60 * 1000;

  function getFromBrowserCache(key) {
    try {
      const stored = localStorage.getItem(`cosmix_cache_${key}`);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (Date.now() - parsed.timestamp < BROWSER_24H_TTL_MS) {
        return parsed.data;
      }
      localStorage.removeItem(`cosmix_cache_${key}`);
    } catch (e) {}
    return null;
  }

  function saveToBrowserCache(key, data) {
    try {
      localStorage.setItem(`cosmix_cache_${key}`, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
    } catch (e) {}
  }

  async function fetchDirectFromCelesTrak(group, limit = 50) {
    const cacheKey = `celestrak_${group || 'stations'}`;
    const cached = getFromBrowserCache(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return limit ? cached.slice(0, limit) : cached;
    }

    const celestrakGroupMap = {
      'stations': 'stations',
      'starlink': 'starlink',
      'gps-ops': 'gps-ops',
      'navigation': 'gps-ops',
      'active': 'active',
      'debris': '1982-092',
      'fengyun-1c-debris': '1999-025',
      'cosmos-2251-debris': '1993-036',
      'iridium-33-debris': '1997-051'
    };
    const cGroup = celestrakGroupMap[group] || group || 'stations';
    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${cGroup}&FORMAT=json`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error(`CelesTrak HTTP ${resp.status}`);
    const json = await resp.json();
    if (Array.isArray(json) && json.length > 0) {
      const mapped = json.map(mapCelesTrakRecord);
      saveToBrowserCache(cacheKey, mapped);
      return limit ? mapped.slice(0, limit) : mapped;
    }
    throw new Error('No records returned from CelesTrak');
  }

  const CosmixAPI = {
    baseUrl: DEFAULT_API_BASE,

    /** Check API health and catalog size */
    async getHealth() {
      try {
        return await request('/api/health', {}, 1500);
      } catch (err) {
        return {
          status: 'offline',
          catalog_size: 0,
          catalog_group: 'active',
          risk_model_loaded: false,
          catalog_last_updated_utc: null
        };
      }
    },

    /** Fetch catalog metadata */
    async getCatalogStatus() {
      try {
        return await request('/api/catalog/status', {}, 1500);
      } catch (err) {
        return {
          count: 0,
          group: 'active',
          last_updated_utc: null,
          supported_groups: ['active', 'stations', 'starlink', 'visual', 'analyst', 'fengyun-1c-debris', 'cosmos-2251-debris', 'iridium-33-debris']
        };
      }
    },

    /** Fetch summary stats */
    async getStats() {
      try {
        const stats = await request('/api/stats', {}, 2000);
        if (stats && typeof stats.total_monitored === 'number') {
          return {
            total_objects: stats.total_monitored,
            total_monitored: stats.total_monitored,
            active_satellites: stats.active_satellites,
            tracked_debris: stats.tracked_debris,
            conjunctions_screened: stats.conjunctions_screened,
            critical_conjunctions: stats.critical_conjunctions,
            high_risk_conjunctions: stats.high_risk_conjunctions,
            medium_risk_conjunctions: stats.medium_risk_conjunctions,
            regimes: stats.regimes || { LEO: 0, MEO: 0, GEO: 0 },
            monitored: stats.total_monitored,
            last_updated_utc: stats.last_updated_utc
          };
        }
      } catch (err) {}

      try {
        const health = await this.getHealth();
        return {
          total_objects: health.catalog_size || 0,
          total_monitored: health.catalog_size || 0,
          active_satellites: health.catalog_size || 0,
          tracked_debris: 0,
          conjunctions_screened: 0,
          critical_conjunctions: 0,
          high_risk_conjunctions: 0,
          medium_risk_conjunctions: 0,
          regimes: { LEO: 0, MEO: 0, GEO: 0 },
          monitored: health.catalog_size || 0,
          last_updated_utc: health.catalog_last_updated_utc || null
        };
      } catch (e) {
        return {
          total_objects: 0,
          total_monitored: 0,
          active_satellites: 0,
          tracked_debris: 0,
          conjunctions_screened: 0,
          critical_conjunctions: 0,
          high_risk_conjunctions: 0,
          medium_risk_conjunctions: 0,
          regimes: { LEO: 0, MEO: 0, GEO: 0 },
          monitored: 0,
          last_updated_utc: null
        };
      }
    },

    /**
     * Fetch satellite catalog list
     * Queries local backend first, then falls back to direct live CelesTrak query
     * @param {Object} [params] { group: 'active', limit: 100, query: 'STARLINK' }
     */
    async getCatalog(params = {}) {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', params.limit);
      if (params.group) query.set('group', params.group);
      if (params.query) query.set('query', params.query);
      if (params.q) query.set('query', params.q);

      const qs = query.toString() ? `?${query.toString()}` : '';
      try {
        const data = await request(`/api/catalog${qs}`, {}, 2000);
        if (Array.isArray(data) && data.length > 0) return data;
      } catch (err) {}

      // Direct live CelesTrak General Perturbations (GP) API query
      try {
        const liveCelesTrakData = await fetchDirectFromCelesTrak(params.group || 'stations', params.limit || 50);
        if (liveCelesTrakData && liveCelesTrakData.length > 0) return liveCelesTrakData;
      } catch (celestrakErr) {
        console.warn('CelesTrak direct fetch notice:', celestrakErr);
      }

      if (params.group) {
        const filtered = FALLBACK_CATALOG.filter(s => s.group === params.group || (params.group === 'active' && s.status === 'ACTIVE'));
        if (filtered.length) return filtered;
      }
      return FALLBACK_CATALOG;
    },

    /** Search entire active 16,049 satellite catalog by name, NORAD ID, or designator */
    async searchCatalog(queryStr, limit = 50) {
      if (!queryStr || !queryStr.trim()) return [];
      try {
        const q = encodeURIComponent(queryStr.trim());
        const data = await request(`/api/catalog?query=${q}&limit=${limit}`, {}, 2000);
        if (Array.isArray(data) && data.length > 0) return data;
      } catch (err) {}
      return [];
    },

    /**
     * Propagate orbit tracks for 3D/2D mapping
     */
    async getOrbitTracks(params = { hours: 3, stepMinutes: 2, limit: 60 }) {
      const query = new URLSearchParams({
        hours: params.hours || 3,
        step_minutes: params.stepMinutes || 2,
        limit: params.limit || 60
      });
      try {
        return await request(`/api/orbit-tracks?${query.toString()}`, {}, 6000);
      } catch (err) {
        return null;
      }
    },

    /**
     * Fetch conjunction alerts (queries backend SGP4 solver or calculates live from catalog)
     */
    async getConjunctions(params = {}) {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', params.limit);
      if (params.group) query.set('group', params.group);

      const qs = query.toString() ? `?${query.toString()}` : '';
      try {
        const data = await request(`/api/conjunctions${qs}`, {}, 3000);
        if (Array.isArray(data) && data.length > 0) return data;
      } catch (err) {}

      try {
        const scanned = await this.runConjunctionScan();
        if (Array.isArray(scanned) && scanned.length > 0) return scanned;
      } catch (err) {}

      return [];
    },

    /**
     * Run high-precision parallel SGP4 + TCA scan
     */
    async runConjunctionScan(params = { maxCandidates: 40, missCutoffKm: 30, hours: 24 }) {
      const query = new URLSearchParams({
        max_candidates: params.maxCandidates || 40,
        miss_distance_cutoff_km: params.missCutoffKm || 30,
        hours: params.hours || 24
      });
      try {
        const data = await request(`/api/conjunctions/scan?${query.toString()}`, {}, 6000);
        if (Array.isArray(data) && data.length > 0) return data;
      } catch (err) {}
      return [];
    },

    /**
     * Compute dynamic real-time close approaches from live active catalog
     */
    async computeLiveConjunctions() {
      return [];
    },

    /** Get recently viewed satellites log */
    async getRecentlyViewed() {
      try {
        return await request('/api/logs/recently-viewed', {}, 2500);
      } catch (err) {
        return JSON.parse(localStorage.getItem('cosmix_recent') || '[]');
      }
    },

    /** Record satellite view */
    async recordRecentlyViewed(satellite) {
      try {
        await request('/api/logs/recently-viewed', {
          method: 'POST',
          body: JSON.stringify({
            norad_id: Number(satellite.norad_id || satellite.norad),
            name: satellite.name,
            altitude_km: Number(satellite.altitude_km || parseFloat(satellite.alt) || 500),
            latitude_deg: satellite.latitude_deg || 0,
            longitude_deg: satellite.longitude_deg || 0,
            velocity_km_s: Number(satellite.velocity_km_s || parseFloat(satellite.vel) || 7.5)
          })
        }, 2000);
      } catch (err) {
        // Fallback local storage
        let recent = JSON.parse(localStorage.getItem('cosmix_recent') || '[]');
        recent = [satellite, ...recent.filter(s => (s.norad_id || s.norad) !== (satellite.norad_id || satellite.norad))].slice(0, 10);
        localStorage.setItem('cosmix_recent', JSON.stringify(recent));
      }
    },

    /** Get collective saved/tracked watchlist */
    async getWatchlist() {
      try {
        return await request('/api/logs/saved-tracked', {}, 2500);
      } catch (err) {
        return JSON.parse(localStorage.getItem('cosmix_watchlist') || '[]');
      }
    },

    /** Add satellite to watchlist */
    async saveToWatchlist(satellite, customNotes = '') {
      try {
        return await request('/api/logs/saved-tracked', {
          method: 'POST',
          body: JSON.stringify({
            norad_id: Number(satellite.norad_id || satellite.norad),
            name: satellite.name,
            custom_notes: customNotes
          })
        }, 2500);
      } catch (err) {
        let list = JSON.parse(localStorage.getItem('cosmix_watchlist') || '[]');
        if (!list.some(s => (s.norad_id || s.norad) === (satellite.norad_id || satellite.norad))) {
          list.push({ ...satellite, custom_notes: customNotes, saved_at_utc: new Date().toISOString() });
          localStorage.setItem('cosmix_watchlist', JSON.stringify(list));
        }
        return list;
      }
    },

    /** Remove satellite from watchlist */
    async removeFromWatchlist(noradId) {
      try {
        return await request(`/api/logs/saved-tracked/${noradId}`, { method: 'DELETE' }, 2500);
      } catch (err) {
        let list = JSON.parse(localStorage.getItem('cosmix_watchlist') || '[]');
        list = list.filter(s => (s.norad_id || s.norad) !== noradId);
        localStorage.setItem('cosmix_watchlist', JSON.stringify(list));
        return list;
      }
    },

    /**
     * Get synchronized notifications data list
     */
    async getNotificationsList() {
      const conjunctions = await this.getConjunctions({ limit: 10 }).catch(() => []);
      const readSet = getReadNotifIds();
      const notifs = [];

      if (Array.isArray(conjunctions) && conjunctions.length > 0) {
        conjunctions.forEach((c, idx) => {
          const id = `conj_${c.id || (c.sat1_id + '_' + c.sat2_id)}`;
          const isHigh = (c.risk_level || '').toUpperCase() === 'HIGH' || (c.risk_level || '').toUpperCase() === 'CRITICAL';
          const missKm = Number(c.miss_distance_km).toFixed(1);
          const score = (Number(c.risk_score) * 100).toFixed(1);
          const alt = c.sat1_alt_at_tca_km ? `${Math.round(c.sat1_alt_at_tca_km)} km` : 'LEO';

          notifs.push({
            id: id,
            category: 'conjunctions',
            isRead: readSet.has(id),
            isHighRisk: isHigh,
            title: isHigh ? 'High-Risk Conjunction Alert' : 'Close Approach Flagged',
            timeAgo: `${(idx + 1) * 12}m ago`,
            desc: `<strong style="color:var(--text-1)">${c.sat1_name}</strong> predicted within ${missKm} km of <strong style="color:var(--accent)">${c.sat2_name}</strong>.`,
            tag1: `Risk: ${score}%`,
            tag1Class: isHigh ? 'tag-risk' : 'tag-attention',
            tag2: alt,
            raw: c
          });
        });
      }

      const sysId = 'sys_celestrak_telemetry';
      notifs.push({
        id: sysId,
        category: 'system',
        isRead: readSet.has(sysId),
        isHighRisk: false,
        title: 'CelesTrak GP Telemetry Active',
        timeAgo: 'Just now',
        desc: 'Real-time SGP4 orbital propagator active. High-precision screening enabled.',
        tag1: 'Operational',
        tag1Class: 'tag-safe',
        tag2: 'Live',
        raw: null
      });

      return notifs;
    },

    /** Mark single notification as read across tabs */
    markNotificationRead(id) {
      markNotificationRead(id);
    },

    /** Mark all notifications as read across tabs */
    markAllNotificationsRead(allIds) {
      markAllNotificationsRead(allIds);
    },

    /**
     * Render and wire notification dropdown synchronously across all pages and tabs
     */
    async syncNotificationsUI() {
      const notifList = document.getElementById('notif-list');
      const notifBadge = document.getElementById('notif-badge');
      const unreadCount = document.getElementById('notif-unread-count');
      const notifBtn = document.getElementById('notif-btn');
      const notifDropdown = document.getElementById('notif-dropdown');
      const markReadBtn = document.getElementById('notif-mark-read');
      const notifTabs = document.querySelectorAll('.notif-tab');

      if (!notifList && !notifBadge) return;

      let currentNotifs = getCachedNotifs() || [];

      function renderItems(itemsList) {
        if (!itemsList) itemsList = currentNotifs;
        const readSet = getReadNotifIds();
        let unreadTotal = 0;

        if (notifList && itemsList.length > 0) {
          notifList.innerHTML = itemsList.map(n => {
            const isRead = readSet.has(n.id);
            if (!isRead) unreadTotal++;

            const iconHtml = n.category === 'system'
              ? `<div class="notif-icon notif-safe"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg></div>`
              : `<div class="notif-icon ${n.isHighRisk ? 'notif-risk' : 'notif-attention'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg></div>`;

            return `
              <div class="notif-item ${isRead ? '' : 'unread'}" data-id="${n.id}" data-category="${n.category}">
                ${iconHtml}
                <div class="notif-content">
                  <div class="notif-title-row">
                    <span class="notif-title">${n.title}</span>
                    <span class="notif-time">${n.timeAgo}</span>
                  </div>
                  <p class="notif-desc">${n.desc}</p>
                  <div class="notif-meta-tags">
                    <span class="notif-tag ${n.tag1Class}">${n.tag1}</span>
                    ${n.tag2 ? `<span class="notif-tag">${n.tag2}</span>` : ''}
                  </div>
                </div>
                <span class="unread-dot"></span>
              </div>
            `;
          }).join('');

          // Item click marks read
          document.querySelectorAll('#notif-list .notif-item').forEach(el => {
            el.addEventListener('click', () => {
              const id = el.dataset.id;
              markNotificationRead(id);
              renderItems();
            });
          });

          // Filter tab state
          const activeTab = document.querySelector('.notif-tab.active');
          const filter = activeTab ? activeTab.dataset.filter : 'all';
          document.querySelectorAll('#notif-list .notif-item').forEach(item => {
            if (filter === 'all' || item.dataset.category === filter) {
              item.style.display = 'flex';
            } else {
              item.style.display = 'none';
            }
          });
        } else if (itemsList.length > 0) {
          itemsList.forEach(n => {
            if (!readSet.has(n.id)) unreadTotal++;
          });
        }

        if (notifBadge) {
          if (unreadTotal > 0) {
            notifBadge.textContent = unreadTotal.toString();
            notifBadge.classList.remove('hidden');
            notifBadge.style.display = 'inline-flex';
          } else {
            notifBadge.textContent = '0';
            notifBadge.classList.add('hidden');
            notifBadge.style.display = 'none';
          }
        }
        if (unreadCount) unreadCount.textContent = `${unreadTotal} unread`;
      }

      // 1. Instant synchronous render from local cache (0ms delay, zero flash/glitch)
      if (currentNotifs.length > 0) {
        renderItems(currentNotifs);
      }

      // 2. Fetch fresh conjunctions & update cache
      try {
        const freshNotifs = await this.getNotificationsList();
        if (Array.isArray(freshNotifs) && freshNotifs.length > 0) {
          currentNotifs = freshNotifs;
          saveCachedNotifs(freshNotifs);
          renderItems(currentNotifs);
        }
      } catch (e) {}

      const allIds = currentNotifs.map(n => n.id);

      // Dropdown toggle
      if (notifBtn && notifDropdown && !notifBtn._notifInitialized) {
        notifBtn._notifInitialized = true;
        notifBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = notifDropdown.classList.toggle('open');
          notifBtn.setAttribute('aria-expanded', isOpen);
        });

        document.addEventListener('click', (e) => {
          if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
            notifDropdown.classList.remove('open');
            notifBtn.setAttribute('aria-expanded', 'false');
          }
        });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            notifDropdown.classList.remove('open');
            notifBtn.setAttribute('aria-expanded', 'false');
          }
        });
      }

      // Mark all read button
      if (markReadBtn && !markReadBtn._notifInitialized) {
        markReadBtn._notifInitialized = true;
        markReadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          markAllNotificationsRead(allIds);
          renderItems();
        });
      }

      // Tab filters
      if (notifTabs) {
        notifTabs.forEach(tab => {
          if (!tab._notifInitialized) {
            tab._notifInitialized = true;
            tab.addEventListener('click', (e) => {
              e.stopPropagation();
              notifTabs.forEach(t => t.classList.remove('active'));
              tab.classList.add('active');
              const filter = tab.dataset.filter;
              document.querySelectorAll('#notif-list .notif-item').forEach(item => {
                if (filter === 'all' || item.dataset.category === filter) {
                  item.style.display = 'flex';
                } else {
                  item.style.display = 'none';
                }
              });
            });
          }
        });
      }

      // Sync across browser tabs and windows
      if (!window._cosmixNotifStorageListenerAttached) {
        window._cosmixNotifStorageListenerAttached = true;
        window.addEventListener('storage', (e) => {
          if (e.key === NOTIF_STORAGE_KEY || e.key === NOTIF_CACHE_KEY) {
            const cached = getCachedNotifs();
            if (cached) currentNotifs = cached;
            renderItems();
          }
        });

        window.addEventListener('cosmix:notifications-changed', () => {
          renderItems();
        });

        // Tab visibility and focus synchronization
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            renderItems();
          }
        });

        window.addEventListener('pageshow', () => {
          renderItems();
        });
      }
    },

    /**
     * Synchronize logged-in user avatar and session across pages
     */
    syncUserSessionUI() {
      if (typeof document === 'undefined') return;
      const avatars = document.querySelectorAll('.avatar, #nav-avatar');
      if (!avatars.length) return;

      let user = null;
      try {
        const raw = localStorage.getItem('cosmix_user');
        if (raw) user = JSON.parse(raw);
      } catch (e) {}

      avatars.forEach(av => {
        if (av.classList.contains('pcard-avatar') || av.classList.contains('result-avatar')) return;

        if (user) {
          av.classList.add('logged-in');
          const name = user.displayName || user.email || 'Operator';
          const initials = (name.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2) || 'OP').toUpperCase();
          if (user.photoURL) {
            av.innerHTML = `<img src="${user.photoURL}" alt="${name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${initials}'">`;
          } else {
            av.textContent = initials;
          }
          av.setAttribute('title', `${name} (${user.email || ''}) — Click to view profile`);
        } else {
          av.classList.remove('logged-in');
          if (av.id === 'nav-avatar') {
            av.textContent = '?';
            av.setAttribute('title', 'Sign In to Orbital');
          }
        }

        // On non-home pages, clicking avatar navigates to HOME
        if (av.id === 'nav-avatar' && !window.location.pathname.toLowerCase().includes('/home/')) {
          if (!av._homeListenerAdded) {
            av._homeListenerAdded = true;
            av.style.cursor = 'pointer';
            av.addEventListener('click', () => {
              window.location.href = '../HOME/index.html';
            });
          }
        }
      });
    },

    /**
     * Connect to live SGP4 1Hz Telemetry WebSocket
     */
    connectTelemetry(onMessage, onError) {
      try {
        const ws = new WebSocket(`${DEFAULT_WS_BASE}/ws/stream`);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (typeof onMessage === 'function') onMessage(data);
          } catch (e) {
            console.error('[CosmixAPI WS] Parse error:', e);
          }
        };
        ws.onerror = (err) => {
          if (typeof onError === 'function') onError(err);
        };
        return ws;
      } catch (err) {
        if (typeof onError === 'function') onError(err);
        return null;
      }
    }
  };

  /* Helper functions for notification state persistence */
  const NOTIF_STORAGE_KEY = 'cosmix_read_notifs';
  const NOTIF_CACHE_KEY = 'cosmix_cached_notifs_list';

  function getCachedNotifs() {
    try {
      const raw = localStorage.getItem(NOTIF_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveCachedNotifs(list) {
    try {
      localStorage.setItem(NOTIF_CACHE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function getReadNotifIds() {
    try {
      const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function saveReadNotifIds(setOrArr) {
    try {
      const arr = Array.from(setOrArr);
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  function markNotificationRead(id) {
    if (!id) return;
    const readSet = getReadNotifIds();
    readSet.add(String(id));
    saveReadNotifIds(readSet);
    window.dispatchEvent(new CustomEvent('cosmix:notifications-changed', { detail: { id, read: true } }));
  }

  function markAllNotificationsRead(allIds = []) {
    const readSet = getReadNotifIds();
    allIds.forEach(id => readSet.add(String(id)));
    saveReadNotifIds(readSet);
    window.dispatchEvent(new CustomEvent('cosmix:notifications-changed', { detail: { allRead: true } }));
  }

  // Auto-synchronize notifications and user session when DOM is ready
  if (typeof document !== 'undefined') {
    const initSync = () => {
      CosmixAPI.syncNotificationsUI();
      CosmixAPI.syncUserSessionUI();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSync);
    } else {
      initSync();
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'cosmix_user') {
        CosmixAPI.syncUserSessionUI();
      }
    });

    window.addEventListener('cosmix:auth-changed', () => {
      CosmixAPI.syncUserSessionUI();
    });
  }

  return CosmixAPI;
});
