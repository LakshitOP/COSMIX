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

  // Base URL resolution: use local backend during local development,
  // and Azure for deployed static frontends.
  const PRODUCTION_API_BASE =
    'https://cosmix-backend-lakshit.azurewebsites.net';

  const DEFAULT_API_BASE = (() => {
    if (typeof window === 'undefined') return PRODUCTION_API_BASE;

    if (window.COSMIX_API_URL) return window.COSMIX_API_URL;

    const host = window.location.hostname;

    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000';
    }

    if (window.location.port === '8000') {
      return window.location.origin;
    }

    return PRODUCTION_API_BASE;
  })().replace(/\/+$/, '');

  const DEFAULT_WS_BASE = DEFAULT_API_BASE.replace(/^http/, 'ws');

  // In-memory instant cache to avoid duplicate network latency
  const _API_CACHE = new Map();
  const CACHE_TTL_MS = 20000;
  const USER_STORAGE_KEY = 'cosmix_user';

  function isAuthenticated() {
    try {
      if (typeof localStorage === 'undefined') return false;

      const raw = localStorage.getItem(USER_STORAGE_KEY);
      const user = raw ? JSON.parse(raw) : null;

      return !!(user && (user.uid || user.email));
    } catch (e) {
      return false;
    }
  }

  function authRequiredError() {
    const err = new Error(
      'Sign in required to access ORBITAL data.'
    );

    err.code = 'AUTH_REQUIRED';

    return err;
  }

  // ---------------------------------------------------------------------------
  // STATIC EMERGENCY FALLBACK
  // ---------------------------------------------------------------------------

  // Used only when the backend itself is temporarily unavailable.
  // IMPORTANT: this is NOT a live data source.
  const FALLBACK_CATALOG = [
    {
      norad_id: 25544,
      name: 'ISS (ZARYA)',
      intl_designator: '1998-067A',
      apogee_km: 422.0,
      perigee_km: 416.0,
      inclination_deg: 51.64,
      period_min: 92.9,
      bstar_drag: 0.000142,
      status: 'ACTIVE',
      regime: 'LEO',
      group: 'stations'
    },
    {
      norad_id: 48274,
      name: 'TIANGONG (CSS)',
      intl_designator: '2021-035A',
      apogee_km: 392.0,
      perigee_km: 386.0,
      inclination_deg: 41.47,
      period_min: 92.3,
      bstar_drag: 0.000115,
      status: 'ACTIVE',
      regime: 'LEO',
      group: 'stations'
    },
    {
      norad_id: 20580,
      name: 'HST (HUBBLE)',
      intl_designator: '1990-037B',
      apogee_km: 541.0,
      perigee_km: 535.0,
      inclination_deg: 28.47,
      period_min: 95.3,
      bstar_drag: 0.000031,
      status: 'ACTIVE',
      regime: 'LEO',
      group: 'active'
    },
    {
      norad_id: 49728,
      name: 'STARLINK-3021',
      intl_designator: '2021-105A',
      apogee_km: 553.0,
      perigee_km: 548.0,
      inclination_deg: 53.22,
      period_min: 95.6,
      bstar_drag: 0.000095,
      status: 'ACTIVE',
      regime: 'LEO',
      group: 'starlink'
    },
    {
      norad_id: 44714,
      name: 'STARLINK-1007',
      intl_designator: '2019-074A',
      apogee_km: 550.0,
      perigee_km: 546.0,
      inclination_deg: 53.05,
      period_min: 95.5,
      bstar_drag: 0.000085,
      status: 'ACTIVE',
      regime: 'LEO',
      group: 'starlink'
    },
    {
      norad_id: 48021,
      name: 'STARLINK-2451',
      intl_designator: '2021-024A',
      apogee_km: 552.0,
      perigee_km: 547.0,
      inclination_deg: 53.22,
      period_min: 95.6,
      bstar_drag: 0.000092,
      status: 'ACTIVE',
      regime: 'LEO',
      group: 'starlink'
    },
    {
      norad_id: 20724,
      name: 'GPS BIIA-10 (PRN 32)',
      intl_designator: '1990-068A',
      apogee_km: 20230.0,
      perigee_km: 20170.0,
      inclination_deg: 55.02,
      period_min: 717.9,
      bstar_drag: 0.000005,
      status: 'ACTIVE',
      regime: 'MEO',
      group: 'gps-ops'
    },
    {
      norad_id: 48859,
      name: 'GPS III-SV05',
      intl_designator: '2021-054A',
      apogee_km: 20210.0,
      perigee_km: 20150.0,
      inclination_deg: 55.00,
      period_min: 717.8,
      bstar_drag: 0.000004,
      status: 'ACTIVE',
      regime: 'MEO',
      group: 'gps-ops'
    },
    {
      norad_id: 43566,
      name: 'GALILEO-26 (GSAT0224)',
      intl_designator: '2018-060C',
      apogee_km: 23230.0,
      perigee_km: 23214.0,
      inclination_deg: 56.00,
      period_min: 844.0,
      bstar_drag: 0.000003,
      status: 'ACTIVE',
      regime: 'MEO',
      group: 'gps-ops'
    },
    {
      norad_id: 33591,
      name: 'NOAA 19',
      intl_designator: '2009-005A',
      apogee_km: 868.0,
      perigee_km: 846.0,
      inclination_deg: 98.71,
      period_min: 102.1,
      bstar_drag: 0.000062,
      status: 'ACTIVE',
      regime: 'LEO',
      group: 'active'
    },
    {
      norad_id: 25994,
      name: 'TERRA (EOS AM-1)',
      intl_designator: '1999-068A',
      apogee_km: 708.0,
      perigee_km: 705.0,
      inclination_deg: 98.20,
      period_min: 98.8,
      bstar_drag: 0.000045,
      status: 'ACTIVE',
      regime: 'LEO',
      group: 'active'
    },
    {
      norad_id: 27424,
      name: 'AQUA (EOS PM-1)',
      intl_designator: '2002-022A',
      apogee_km: 705.0,
      perigee_km: 702.0,
      inclination_deg: 98.19,
      period_min: 98.7,
      bstar_drag: 0.000048,
      status: 'ACTIVE',
      regime: 'LEO',
      group: 'active'
    },
    {
      norad_id: 39634,
      name: 'SENTINEL-1A',
      intl_designator: '2014-016A',
      apogee_km: 694.0,
      perigee_km: 692.0,
      inclination_deg: 98.18,
      period_min: 98.5,
      bstar_drag: 0.000028,
      status: 'ACTIVE',
      regime: 'LEO',
      group: 'active'
    },
    {
      norad_id: 39084,
      name: 'LANDSAT 8',
      intl_designator: '2013-008A',
      apogee_km: 705.0,
      perigee_km: 703.0,
      inclination_deg: 98.22,
      period_min: 98.8,
      bstar_drag: 0.000033,
      status: 'ACTIVE',
      regime: 'LEO',
      group: 'active'
    },
    {
      norad_id: 29677,
      name: 'FENGYUN 1C DEB',
      intl_designator: '1999-025DF',
      apogee_km: 845.0,
      perigee_km: 790.0,
      inclination_deg: 98.85,
      period_min: 101.2,
      bstar_drag: 0.000312,
      status: 'DEBRIS',
      regime: 'LEO',
      group: 'debris'
    },
    {
      norad_id: 49700,
      name: 'COSMOS 1408 DEB',
      intl_designator: '1982-092A',
      apogee_km: 495.0,
      perigee_km: 465.0,
      inclination_deg: 82.60,
      period_min: 94.2,
      bstar_drag: 0.000350,
      status: 'DEBRIS',
      regime: 'LEO',
      group: 'debris'
    },
    {
      norad_id: 33500,
      name: 'COSMOS 2251 DEB',
      intl_designator: '1993-036KW',
      apogee_km: 830.0,
      perigee_km: 785.0,
      inclination_deg: 74.02,
      period_min: 100.8,
      bstar_drag: 0.000280,
      status: 'DEBRIS',
      regime: 'LEO',
      group: 'debris'
    },
    {
      norad_id: 33783,
      name: 'IRIDIUM 33 DEB',
      intl_designator: '1997-051AQ',
      apogee_km: 792.0,
      perigee_km: 760.0,
      inclination_deg: 86.40,
      period_min: 100.2,
      bstar_drag: 0.000210,
      status: 'DEBRIS',
      regime: 'LEO',
      group: 'debris'
    },
    {
      norad_id: 19650,
      name: 'SL-16 R/B (STAGE)',
      intl_designator: '1988-102B',
      apogee_km: 875.0,
      perigee_km: 845.0,
      inclination_deg: 71.01,
      period_min: 102.1,
      bstar_drag: 0.000260,
      status: 'DEBRIS',
      regime: 'LEO',
      group: 'debris'
    }
  ];

  // ---------------------------------------------------------------------------
  // HTTP REQUEST
  // ---------------------------------------------------------------------------

  async function request(endpoint, options = {}, timeoutMs = 8000) {
    const isGet =
      !options.method ||
      options.method.toUpperCase() === 'GET';

    const cacheKey = endpoint;

    if (isGet && _API_CACHE.has(cacheKey)) {
      const cached = _API_CACHE.get(cacheKey);

      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

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
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();

      if (isGet) {
        _API_CACHE.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }

      return data;

    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // HEALTH
  // ---------------------------------------------------------------------------

  const CosmixAPI = {

    baseUrl: DEFAULT_API_BASE,

    async getHealth() {
      try {
        return await request(
          '/api/health',
          {},
          10000
        );
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

    // -------------------------------------------------------------------------
    // CATALOG STATUS
    // -------------------------------------------------------------------------

    async getCatalogStatus() {
      try {
        return await request(
          '/api/catalog/status',
          {},
          10000
        );
      } catch (err) {
        return {
          count: 0,
          group: 'active',
          last_updated_utc: null,
          supported_groups: [
            'active',
            'stations',
            'starlink',
            'visual',
            'analyst',
            'fengyun-1c-debris',
            'cosmos-2251-debris',
            'iridium-33-debris'
          ]
        };
      }
    },

    // -------------------------------------------------------------------------
    // STATS
    // -------------------------------------------------------------------------

    async getStats() {
      try {
        const stats = await request(
          '/api/stats',
          {},
          10000
        );

        if (
          stats &&
          typeof stats.total_monitored === 'number'
        ) {
          return {
            total_objects: stats.total_monitored,
            total_monitored: stats.total_monitored,
            active_satellites: stats.active_satellites,
            tracked_debris: stats.tracked_debris,
            conjunctions_screened: stats.conjunctions_screened,
            critical_conjunctions: stats.critical_conjunctions,
            high_risk_conjunctions: stats.high_risk_conjunctions,
            medium_risk_conjunctions: stats.medium_risk_conjunctions,
            regimes: stats.regimes || {
              LEO: 0,
              MEO: 0,
              GEO: 0
            },
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
          regimes: {
            LEO: 0,
            MEO: 0,
            GEO: 0
          },
          monitored: health.catalog_size || 0,
          last_updated_utc:
            health.catalog_last_updated_utc || null
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
          regimes: {
            LEO: 0,
            MEO: 0,
            GEO: 0
          },
          monitored: 0,
          last_updated_utc: null
        };
      }
    },

    // -------------------------------------------------------------------------
    // CATALOG
    // -------------------------------------------------------------------------

    /**
     * Fetch satellite catalog list.
     *
     * LIVE DATA:
     *
     * Browser
     *    ↓
     * FastAPI
     *    ↓
     * PostgreSQL / backend cache
     *    ↓
     * CelesTrak
     *
     * The browser NEVER calls CelesTrak directly.
     */
    async getCatalog(params = {}) {

      const query = new URLSearchParams();

      if (params.limit) {
        query.set(
          'limit',
          String(params.limit)
        );
      }

      if (params.group) {
        query.set(
          'group',
          String(params.group)
        );
      }

      if (params.query) {
        query.set(
          'query',
          String(params.query)
        );
      }

      if (params.q) {
        query.set(
          'query',
          String(params.q)
        );
      }

      const qs =
        query.toString()
          ? `?${query.toString()}`
          : '';

      try {

        const data = await request(
          `/api/catalog${qs}`,
          {},
          12000
        );

        // Normal backend response
        if (
          Array.isArray(data) &&
          data.length > 0
        ) {
          return data;
        }

        // Support wrapped response
        if (
          data &&
          Array.isArray(data.items) &&
          data.items.length > 0
        ) {
          return data.items;
        }

        // Support alternate wrapped response
        if (
          data &&
          Array.isArray(data.results) &&
          data.results.length > 0
        ) {
          return data.results;
        }

      } catch (err) {

        console.warn(
          '[CosmixAPI] Catalog backend unavailable:',
          err
        );
      }

      // -----------------------------------------------------------------------
      // IMPORTANT:
      // Do NOT call CelesTrak here.
      //
      // The old implementation did:
      //
      // Browser → CelesTrak
      //
      // which caused:
      //
      // 403 Forbidden
      // Unexpected token 'I' ... invalid JSON
      //
      // CelesTrak should be accessed server-side by FastAPI.
      // -----------------------------------------------------------------------

      // Emergency static fallback.
      if (params.group) {

        const group =
          String(params.group).toLowerCase();

        const filtered =
          FALLBACK_CATALOG.filter(
            s =>
              s.group === group ||
              (
                group === 'active' &&
                s.status === 'ACTIVE'
              )
          );

        if (filtered.length > 0) {

          const limit =
            Number(params.limit);

          if (
            Number.isFinite(limit) &&
            limit > 0
          ) {
            return filtered.slice(0, limit);
          }

          return filtered;
        }
      }

      const limit =
        Number(params.limit);

      if (
        Number.isFinite(limit) &&
        limit > 0
      ) {
        return FALLBACK_CATALOG.slice(
          0,
          limit
        );
      }

      return FALLBACK_CATALOG;
    },

    // -------------------------------------------------------------------------
    // SEARCH
    // -------------------------------------------------------------------------

    async searchCatalog(
      queryStr,
      limit = 50
    ) {

      if (
        !queryStr ||
        !queryStr.trim()
      ) {
        return [];
      }

      const normalized =
        queryStr.trim();

      try {

        const q =
          encodeURIComponent(normalized);

        const data =
          await request(
            `/api/catalog?query=${q}&limit=${limit}`,
            {},
            12000
          );

        if (
          Array.isArray(data) &&
          data.length > 0
        ) {
          return data;
        }

        if (
          data &&
          Array.isArray(data.items) &&
          data.items.length > 0
        ) {
          return data.items;
        }

        if (
          data &&
          Array.isArray(data.results) &&
          data.results.length > 0
        ) {
          return data.results;
        }

      } catch (err) {

        console.warn(
          '[CosmixAPI] Catalog search backend unavailable:',
          err
        );
      }

      // Emergency local search only.
      // No CelesTrak request from browser.
      const qLower =
        normalized.toLowerCase();

      const max =
        Number(limit) > 0
          ? Number(limit)
          : 50;

      return FALLBACK_CATALOG
        .filter(s =>
          String(s.name || '')
            .toLowerCase()
            .includes(qLower) ||

          String(s.norad_id || '')
            .includes(normalized) ||

          String(s.intl_designator || '')
            .toLowerCase()
            .includes(qLower)
        )
        .slice(0, max);
    },

    // -------------------------------------------------------------------------
    // ORBIT TRACKS
    // -------------------------------------------------------------------------

    async getOrbitTracks(
      params = {
        hours: 3,
        stepMinutes: 2,
        limit: 60
      }
    ) {

      const query =
        new URLSearchParams({
          hours: params.hours || 3,
          step_minutes:
            params.stepMinutes || 2,
          limit:
            params.limit || 60
        });

      try {

        return await request(
          `/api/orbit-tracks?${query.toString()}`,
          {},
          15000
        );

      } catch (err) {

        return null;
      }
    },

    // -------------------------------------------------------------------------
    // CONJUNCTIONS
    // -------------------------------------------------------------------------

    async getConjunctions(
      params = {}
    ) {

      const query =
        new URLSearchParams();

      if (params.limit) {
        query.set(
          'limit',
          params.limit
        );
      }

      if (params.group) {
        query.set(
          'group',
          params.group
        );
      }

      const qs =
        query.toString()
          ? `?${query.toString()}`
          : '';

      try {

        const data =
          await request(
            `/api/conjunctions${qs}`,
            {},
            15000
          );

        if (
          Array.isArray(data) &&
          data.length > 0
        ) {
          return data;
        }

      } catch (err) {}

      try {

        const scanned =
          await this.runConjunctionScan();

        if (
          Array.isArray(scanned) &&
          scanned.length > 0
        ) {
          return scanned;
        }

      } catch (err) {}

      return [];
    },

    // -------------------------------------------------------------------------
    // CONJUNCTION SCAN
    // -------------------------------------------------------------------------

    async runConjunctionScan(
      params = {
        maxCandidates: 40,
        missCutoffKm: 30,
        hours: 24
      }
    ) {

      const query =
        new URLSearchParams({
          max_candidates:
            params.maxCandidates || 40,

          miss_distance_cutoff_km:
            params.missCutoffKm || 30,

          hours:
            params.hours || 24
        });

      try {

        const data =
          await request(
            `/api/conjunctions/scan?${query.toString()}`,
            {},
            20000
          );

        if (
          Array.isArray(data) &&
          data.length > 0
        ) {
          return data;
        }

      } catch (err) {}

      return [];
    },

    // -------------------------------------------------------------------------
    // LIVE CONJUNCTIONS
    // -------------------------------------------------------------------------

    async computeLiveConjunctions() {
      return [];
    },

    // -------------------------------------------------------------------------
    // RECENTLY VIEWED
    // -------------------------------------------------------------------------

    async getRecentlyViewed() {

      try {

        return await request(
          '/api/logs/recently-viewed',
          {},
          2500
        );

      } catch (err) {

        return JSON.parse(
          localStorage.getItem(
            'cosmix_recent'
          ) || '[]'
        );
      }
    },

    // -------------------------------------------------------------------------
    // RECORD RECENTLY VIEWED
    // -------------------------------------------------------------------------

    async recordRecentlyViewed(
      satellite
    ) {

      try {

        await request(
          '/api/logs/recently-viewed',
          {
            method: 'POST',

            body: JSON.stringify({
              norad_id:
                Number(
                  satellite.norad_id ||
                  satellite.norad
                ),

              name:
                satellite.name,

              altitude_km:
                Number(
                  satellite.altitude_km ||
                  parseFloat(satellite.alt) ||
                  500
                ),

              latitude_deg:
                satellite.latitude_deg || 0,

              longitude_deg:
                satellite.longitude_deg || 0,

              velocity_km_s:
                Number(
                  satellite.velocity_km_s ||
                  parseFloat(satellite.vel) ||
                  7.5
                )
            })
          },
          2000
        );

      } catch (err) {

        let recent =
          JSON.parse(
            localStorage.getItem(
              'cosmix_recent'
            ) || '[]'
          );

        recent = [
          satellite,
          ...recent.filter(
            s =>
              (s.norad_id || s.norad) !==
              (satellite.norad_id ||
                satellite.norad)
          )
        ].slice(0, 10);

        localStorage.setItem(
          'cosmix_recent',
          JSON.stringify(recent)
        );
      }
    },

    // -------------------------------------------------------------------------
    // WATCHLIST
    // -------------------------------------------------------------------------

    async getWatchlist() {

      try {

        return await request(
          '/api/logs/saved-tracked',
          {},
          2500
        );

      } catch (err) {

        return JSON.parse(
          localStorage.getItem(
            'cosmix_watchlist'
          ) || '[]'
        );
      }
    },

    async saveToWatchlist(
      satellite,
      customNotes = ''
    ) {

      try {

        return await request(
          '/api/logs/saved-tracked',
          {
            method: 'POST',

            body: JSON.stringify({
              norad_id:
                Number(
                  satellite.norad_id ||
                  satellite.norad
                ),

              name:
                satellite.name,

              custom_notes:
                customNotes
            })
          },
          2500
        );

      } catch (err) {

        let list =
          JSON.parse(
            localStorage.getItem(
              'cosmix_watchlist'
            ) || '[]'
          );

        if (
          !list.some(
            s =>
              (s.norad_id || s.norad) ===
              (satellite.norad_id ||
                satellite.norad)
          )
        ) {

          list.push({
            ...satellite,
            custom_notes:
              customNotes,
            saved_at_utc:
              new Date().toISOString()
          });

          localStorage.setItem(
            'cosmix_watchlist',
            JSON.stringify(list)
          );
        }

        return list;
      }
    },

    async removeFromWatchlist(
      noradId
    ) {

      try {

        return await request(
          `/api/logs/saved-tracked/${noradId}`,
          {
            method: 'DELETE'
          },
          2500
        );

      } catch (err) {

        let list =
          JSON.parse(
            localStorage.getItem(
              'cosmix_watchlist'
            ) || '[]'
          );

        list =
          list.filter(
            s =>
              (s.norad_id || s.norad) !==
              noradId
          );

        localStorage.setItem(
          'cosmix_watchlist',
          JSON.stringify(list)
        );

        return list;
      }
    },

    // -------------------------------------------------------------------------
    // NOTIFICATIONS
    // -------------------------------------------------------------------------

    async getNotificationsList() {

      const conjunctions =
        await this.getConjunctions({
          limit: 10
        }).catch(() => []);

      const readSet =
        getReadNotifIds();

      const notifs = [];

      if (
        Array.isArray(conjunctions) &&
        conjunctions.length > 0
      ) {

        conjunctions.forEach(
          (c, idx) => {

            const id =
              `conj_${c.id ||
                (c.sat1_id +
                  '_' +
                  c.sat2_id)}`;

            const isHigh =
              (
                c.risk_level || ''
              ).toUpperCase() === 'HIGH' ||

              (
                c.risk_level || ''
              ).toUpperCase() === 'CRITICAL';

            const missKm =
              Number(
                c.miss_distance_km
              ).toFixed(1);

            const score =
              (
                Number(c.risk_score) *
                100
              ).toFixed(1);

            const alt =
              c.sat1_alt_at_tca_km
                ? `${Math.round(
                    c.sat1_alt_at_tca_km
                  )} km`
                : 'LEO';

            notifs.push({

              id,

              category:
                'conjunctions',

              isRead:
                readSet.has(id),

              isHighRisk:
                isHigh,

              title:
                isHigh
                  ? 'High-Risk Conjunction Alert'
                  : 'Close Approach Flagged',

              timeAgo:
                `${(idx + 1) * 12}m ago`,

              desc:
                `<strong style="color:var(--text-1)">${c.sat1_name}</strong> predicted within ${missKm} km of <strong style="color:var(--accent)">${c.sat2_name}</strong>.`,

              tag1:
                `Risk: ${score}%`,

              tag1Class:
                isHigh
                  ? 'tag-risk'
                  : 'tag-attention',

              tag2:
                alt,

              raw:
                c
            });
          }
        );
      }

      const sysId =
        'sys_orbital_telemetry';

      notifs.push({

        id:
          sysId,

        category:
          'system',

        isRead:
          readSet.has(sysId),

        isHighRisk:
          false,

        title:
          'Orbital Telemetry Active',

        timeAgo:
          'Just now',

        desc:
          'Real-time SGP4 orbital propagator active. High-precision screening enabled.',

        tag1:
          'Operational',

        tag1Class:
          'tag-safe',

        tag2:
          'Live',

        raw:
          null
      });

      return notifs;
    },

    markNotificationRead(id) {
      markNotificationRead(id);
    },

    markAllNotificationsRead(allIds) {
      markAllNotificationsRead(allIds);
    },

    // -------------------------------------------------------------------------
    // NOTIFICATION UI
    // -------------------------------------------------------------------------

    async syncNotificationsUI() {

      const notifList =
        document.getElementById(
          'notif-list'
        );

      const notifBadge =
        document.getElementById(
          'notif-badge'
        );

      const unreadCount =
        document.getElementById(
          'notif-unread-count'
        );

      const notifBtn =
        document.getElementById(
          'notif-btn'
        );

      const notifDropdown =
        document.getElementById(
          'notif-dropdown'
        );

      const markReadBtn =
        document.getElementById(
          'notif-mark-read'
        );

      const notifTabs =
        document.querySelectorAll(
          '.notif-tab'
        );

      if (
        !notifList &&
        !notifBadge
      ) {
        return;
      }

      let currentNotifs =
        getCachedNotifs() || [];

      function renderItems(
        itemsList
      ) {

        if (!itemsList) {
          itemsList =
            currentNotifs;
        }

        const readSet =
          getReadNotifIds();

        let unreadTotal = 0;

        if (
          notifList &&
          itemsList.length > 0
        ) {

          notifList.innerHTML =
            itemsList.map(n => {

              const isRead =
                readSet.has(n.id);

              if (!isRead) {
                unreadTotal++;
              }

              const iconHtml =
                n.category === 'system'

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

                    <p class="notif-desc">
                      ${n.desc}
                    </p>

                    <div class="notif-meta-tags">
                      <span class="notif-tag ${n.tag1Class}">
                        ${n.tag1}
                      </span>

                      ${
                        n.tag2
                          ? `<span class="notif-tag">${n.tag2}</span>`
                          : ''
                      }
                    </div>

                  </div>

                  <span class="unread-dot"></span>
                </div>
              `;
            }).join('');

          document
            .querySelectorAll(
              '#notif-list .notif-item'
            )
            .forEach(el => {

              el.addEventListener(
                'click',
                () => {

                  const id =
                    el.dataset.id;

                  markNotificationRead(id);

                  renderItems();
                }
              );
            });

          const activeTab =
            document.querySelector(
              '.notif-tab.active'
            );

          const filter =
            activeTab
              ? activeTab.dataset.filter
              : 'all';

          document
            .querySelectorAll(
              '#notif-list .notif-item'
            )
            .forEach(item => {

              if (
                filter === 'all' ||
                item.dataset.category === filter
              ) {

                item.style.display =
                  'flex';

              } else {

                item.style.display =
                  'none';
              }
            });

        } else if (
          itemsList.length > 0
        ) {

          itemsList.forEach(n => {

            if (!readSet.has(n.id)) {
              unreadTotal++;
            }

          });
        }

        if (notifBadge) {

          if (unreadTotal > 0) {

            notifBadge.textContent =
              unreadTotal.toString();

            notifBadge.classList.remove(
              'hidden'
            );

            notifBadge.style.display =
              'inline-flex';

          } else {

            notifBadge.textContent =
              '0';

            notifBadge.classList.add(
              'hidden'
            );

            notifBadge.style.display =
              'none';
          }
        }

        if (unreadCount) {
          unreadCount.textContent =
            `${unreadTotal} unread`;
        }
      }

      if (currentNotifs.length > 0) {
        renderItems(
          currentNotifs
        );
      }

      try {

        const freshNotifs =
          await this.getNotificationsList();

        if (
          Array.isArray(
            freshNotifs
          ) &&
          freshNotifs.length > 0
        ) {

          currentNotifs =
            freshNotifs;

          saveCachedNotifs(
            freshNotifs
          );

          renderItems(
            currentNotifs
          );
        }

      } catch (e) {}

      const allIds =
        currentNotifs.map(
          n => n.id
        );

      if (
        notifBtn &&
        notifDropdown &&
        !notifBtn._notifInitialized
      ) {

        notifBtn._notifInitialized =
          true;

        notifBtn.addEventListener(
          'click',
          e => {

            e.stopPropagation();

            const isOpen =
              notifDropdown.classList.toggle(
                'open'
              );

            notifBtn.setAttribute(
              'aria-expanded',
              isOpen
            );
          }
        );

        document.addEventListener(
          'click',
          e => {

            if (
              !notifDropdown.contains(
                e.target
              ) &&
              !notifBtn.contains(
                e.target
              )
            ) {

              notifDropdown.classList.remove(
                'open'
              );

              notifBtn.setAttribute(
                'aria-expanded',
                'false'
              );
            }
          }
        );

        document.addEventListener(
          'keydown',
          e => {

            if (e.key === 'Escape') {

              notifDropdown.classList.remove(
                'open'
              );

              notifBtn.setAttribute(
                'aria-expanded',
                'false'
              );
            }
          }
        );
      }

      if (
        markReadBtn &&
        !markReadBtn._notifInitialized
      ) {

        markReadBtn._notifInitialized =
          true;

        markReadBtn.addEventListener(
          'click',
          e => {

            e.stopPropagation();

            markAllNotificationsRead(
              allIds
            );

            renderItems();
          }
        );
      }

      if (notifTabs) {

        notifTabs.forEach(tab => {

          if (
            !tab._notifInitialized
          ) {

            tab._notifInitialized =
              true;

            tab.addEventListener(
              'click',
              e => {

                e.stopPropagation();

                notifTabs.forEach(
                  t =>
                    t.classList.remove(
                      'active'
                    )
                );

                tab.classList.add(
                  'active'
                );

                const filter =
                  tab.dataset.filter;

                document
                  .querySelectorAll(
                    '#notif-list .notif-item'
                  )
                  .forEach(item => {

                    if (
                      filter === 'all' ||
                      item.dataset.category === filter
                    ) {

                      item.style.display =
                        'flex';

                    } else {

                      item.style.display =
                        'none';
                    }
                  });
              }
            );
          }
        });
      }

      if (
        !window._cosmixNotifStorageListenerAttached
      ) {

        window._cosmixNotifStorageListenerAttached =
          true;

        window.addEventListener(
          'storage',
          e => {

            if (
              e.key === NOTIF_STORAGE_KEY ||
              e.key === NOTIF_CACHE_KEY
            ) {

              const cached =
                getCachedNotifs();

              if (cached) {
                currentNotifs =
                  cached;
              }

              renderItems();
            }
          }
        );

        window.addEventListener(
          'cosmix:notifications-changed',
          () => {
            renderItems();
          }
        );

        document.addEventListener(
          'visibilitychange',
          () => {

            if (!document.hidden) {
              renderItems();
            }
          }
        );

        window.addEventListener(
          'pageshow',
          () => {
            renderItems();
          }
        );
      }
    },

    // -------------------------------------------------------------------------
    // USER SESSION
    // -------------------------------------------------------------------------

    syncUserSessionUI() {

      if (
        typeof document === 'undefined'
      ) {
        return;
      }

      const avatars =
        document.querySelectorAll(
          '.avatar, #nav-avatar'
        );

      if (!avatars.length) {
        return;
      }

      let user = null;

      try {

        const raw =
          localStorage.getItem(
            'cosmix_user'
          );

        if (raw) {
          user = JSON.parse(raw);
        }

      } catch (e) {}

      avatars.forEach(av => {

        if (
          av.classList.contains(
            'pcard-avatar'
          ) ||
          av.classList.contains(
            'result-avatar'
          )
        ) {
          return;
        }

        if (user) {

          av.classList.add(
            'logged-in'
          );

          const name =
            user.displayName ||
            user.email ||
            'Operator';

          const initials =
            (
              name
                .trim()
                .split(/\s+/)
                .map(p => p[0])
                .join('')
                .slice(0, 2) ||
              'OP'
            ).toUpperCase();

          if (user.photoURL) {

            av.innerHTML =
              `<img src="${user.photoURL}" alt="${name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${initials}'">`;

          } else {

            av.textContent =
              initials;
          }

          av.setAttribute(
            'title',
            `${name} (${user.email || ''}) — Click to view profile`
          );

        } else {

          av.classList.remove(
            'logged-in'
          );

          if (
            av.id === 'nav-avatar'
          ) {

            av.textContent = '?';

            av.setAttribute(
              'title',
              'Sign In to Orbital'
            );
          }
        }

        if (
          av.id === 'nav-avatar' &&
          !window.location.pathname
            .toLowerCase()
            .includes('/home/')
        ) {

          if (!av._homeListenerAdded) {

            av._homeListenerAdded =
              true;

            av.style.cursor =
              'pointer';

            av.addEventListener(
              'click',
              () => {

                window.location.href =
                  '../HOME/index.html';
              }
            );
          }
        }
      });
    },

    // -------------------------------------------------------------------------
    // WEBSOCKET TELEMETRY
    // -------------------------------------------------------------------------

    connectTelemetry(
      onMessage,
      onError
    ) {

      try {

        const ws =
          new WebSocket(
            `${DEFAULT_WS_BASE}/ws/stream`
          );

        ws.onmessage =
          event => {

            try {

              const data =
                JSON.parse(
                  event.data
                );

              if (
                typeof onMessage ===
                'function'
              ) {

                onMessage(data);
              }

            } catch (e) {

              console.error(
                '[CosmixAPI WS] Parse error:',
                e
              );
            }
          };

        ws.onerror =
          err => {

            if (
              typeof onError ===
              'function'
            ) {

              onError(err);
            }
          };

        return ws;

      } catch (err) {

        if (
          typeof onError ===
          'function'
        ) {

          onError(err);
        }

        return null;
      }
    }
  };

  // ---------------------------------------------------------------------------
  // NOTIFICATION STATE
  // ---------------------------------------------------------------------------

  const NOTIF_STORAGE_KEY =
    'cosmix_read_notifs';

  const NOTIF_CACHE_KEY =
    'cosmix_cached_notifs_list';

  function getCachedNotifs() {

    try {

      const raw =
        localStorage.getItem(
          NOTIF_CACHE_KEY
        );

      return raw
        ? JSON.parse(raw)
        : null;

    } catch (e) {

      return null;
    }
  }

  function saveCachedNotifs(
    list
  ) {

    try {

      localStorage.setItem(
        NOTIF_CACHE_KEY,
        JSON.stringify(list)
      );

    } catch (e) {}
  }

  function getReadNotifIds() {

    try {

      const raw =
        localStorage.getItem(
          NOTIF_STORAGE_KEY
        );

      return raw
        ? new Set(JSON.parse(raw))
        : new Set();

    } catch (e) {

      return new Set();
    }
  }

  function saveReadNotifIds(
    setOrArr
  ) {

    try {

      const arr =
        Array.from(setOrArr);

      localStorage.setItem(
        NOTIF_STORAGE_KEY,
        JSON.stringify(arr)
      );

    } catch (e) {}
  }

  function markNotificationRead(
    id
  ) {

    if (!id) return;

    const readSet =
      getReadNotifIds();

    readSet.add(
      String(id)
    );

    saveReadNotifIds(
      readSet
    );

    window.dispatchEvent(
      new CustomEvent(
        'cosmix:notifications-changed',
        {
          detail: {
            id,
            read: true
          }
        }
      )
    );
  }

  function markAllNotificationsRead(
    allIds = []
  ) {

    const readSet =
      getReadNotifIds();

    allIds.forEach(
      id =>
        readSet.add(
          String(id)
        )
    );

    saveReadNotifIds(
      readSet
    );

    window.dispatchEvent(
      new CustomEvent(
        'cosmix:notifications-changed',
        {
          detail: {
            allRead: true
          }
        }
      )
    );
  }

  // ---------------------------------------------------------------------------
  // AUTO SYNC
  // ---------------------------------------------------------------------------

  if (
    typeof document !== 'undefined'
  ) {

    const initSync = () => {

      if (isAuthenticated()) {

        CosmixAPI
          .syncNotificationsUI();
      }

      CosmixAPI
        .syncUserSessionUI();
    };

    if (
      document.readyState ===
      'loading'
    ) {

      document.addEventListener(
        'DOMContentLoaded',
        initSync
      );

    } else {

      initSync();
    }

    window.addEventListener(
      'storage',
      e => {

        if (
          e.key === 'cosmix_user'
        ) {

          CosmixAPI
            .syncUserSessionUI();
        }
      }
    );

    window.addEventListener(
      'cosmix:auth-changed',
      () => {

        CosmixAPI
          .syncUserSessionUI();
      }
    );
  }

  // ---------------------------------------------------------------------------
  // PROTECTED METHODS
  // ---------------------------------------------------------------------------

  const protectedMethods =
    new Set([
      'getHealth',
      'getCatalogStatus',
      'getStats',
      'getCatalog',
      'searchCatalog',
      'getOrbitTracks',
      'getConjunctions',
      'runConjunctionScan',
      'computeLiveConjunctions',
      'getRecentlyViewed',
      'recordRecentlyViewed',
      'getWatchlist',
      'saveToWatchlist',
      'removeFromWatchlist',
      'getNotificationsList',
      'connectTelemetry'
    ]);

  return new Proxy(
    CosmixAPI,
    {
      get(
        target,
        prop,
        receiver
      ) {

        const value =
          Reflect.get(
            target,
            prop,
            receiver
          );

        if (
          prop ===
            'syncNotificationsUI' &&
          typeof value ===
            'function'
        ) {

          return function (...args) {

            if (
              !isAuthenticated()
            ) {
              return Promise.resolve(
                null
              );
            }

            return value.apply(
              target,
              args
            );
          };
        }

        if (
          protectedMethods.has(
            prop
          ) &&
          typeof value ===
            'function'
        ) {

          return function (...args) {

            if (
              !isAuthenticated()
            ) {

              if (
                prop ===
                'connectTelemetry'
              ) {
                return null;
              }

              return Promise.reject(
                authRequiredError()
              );
            }

            return value.apply(
              target,
              args
            );
          };
        }

        return value;
      }
    }
  );
});