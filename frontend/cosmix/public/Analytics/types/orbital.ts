// Types and Data Interfaces for ORBITAL Analytics Engine

export type OrbitalRegime = 'LEO' | 'MEO' | 'GEO' | 'HEO';

export type ObjectType = 'PAYLOAD' | 'DEBRIS' | 'ROCKET_BODY' | 'UNKNOWN';

export interface OrbitalObject {
  id: string;
  name: string;
  noradId: number;
  type: ObjectType;
  regime: OrbitalRegime;
  altitudeKm: number;
  inclinationDeg: number;
  eccentricity: number;
  periodMin: number;
  velocityKmS: number;
  epoch: string;
  fingerprintHash?: string;
}

export type ZoomLevel = 'EARTH' | 'REGIME' | 'ALTITUDE_BAND' | 'NEIGHBORHOOD' | 'SATELLITE';

export interface CatalogEvent {
  id: string;
  timestamp: number;
  type: 'CLOSE_APPROACH' | 'LAUNCH' | 'FRAGMENTATION' | 'MANEUVER';
  severity: 'CRITICAL' | 'WARNING' | 'NOMINAL';
  primaryObject: string;
  secondaryObject?: string;
  missDistanceKm?: number;
  relVelocityKmS?: number;
  label: string;
}

export interface AxisOption {
  key: keyof OrbitalObject | 'density';
  label: string;
  unit: string;
}

export interface PlaygroundConfig {
  xAxis: keyof OrbitalObject;
  yAxis: keyof OrbitalObject;
  sizeParam: keyof OrbitalObject;
  colorParam: keyof OrbitalObject;
  regimeFilter: OrbitalRegime | 'ALL';
  year: number;
}

