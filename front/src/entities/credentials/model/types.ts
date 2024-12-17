export interface ILocation {
  display: string;
  latitude: number;
  longitude: number;
}

export interface IRegionDetail {
  description: string;
  location: ILocation;
  regionId: string;
  regionName: string;
  zones: string[];
}

export interface IRegionZoneInfo {
  assignedRegion: string;
  assignedZone: string;
}

export interface IConnectionConfig {
  configName: string;
  credentialHolder: string;
  credentialName: string;
  driverName: string;
  providerName: string;
  regionDetail: IRegionDetail;
  regionRepresentative: boolean;
  regionZoneInfo: IRegionZoneInfo;
  regionZoneInfoName: string;
  verified: boolean;
}

export interface IGetConnconfigListResponse {
  connectionconfig: IConnectionConfig[];
}
