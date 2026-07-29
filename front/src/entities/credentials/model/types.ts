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

export interface ICredential {
  CredentialName: string;
  KeyValueInfoList: Array<{
    Key: string;
    Value: string;
  }>;
  ProviderName: string;
}

export interface IGetCredentialListResponse {
  credential: ICredential[];
}
export interface ICreateCredentialsPayload {
  CredentialName: string;
  KeyValueInfoList: Array<{
    Key: string;
    Value: string;
  }>;
  ProviderName: string;
}

export interface IGetProviderListResponse {
  output: string[];
}

// cb-spider's per-provider metadata. Credential holds the field names that
// provider needs; the rest of the payload describes driver capabilities we do not
// use here.
export interface ICloudOsMetaInfoResponse {
  Credential?: string[];
  Region?: string[];
}

export interface ICredentialKeyValue {
  key: string;
  value: string;
}

// Values leave the browser in the clear and are sealed by our api before they
// reach cb-tumblebug. credentialHolder is the owning entity, not a display name -
// cb-tumblebug derives the credential name from holder and provider.
export interface IRegisterCredentialPayload {
  providerName: string;
  credentialHolder: string;
  credentialKeyValueList: ICredentialKeyValue[];
}

export interface IRegisterCredentialResponse {
  credentialName?: string;
  credentialHolder?: string;
  providerName?: string;
  allConnections?: {
    count?: number;
    connectionconfig?: IConnectionConfig[];
  };
  openBaoStatus?: string;
}

export interface ICredentialHolder {
  credentialHolder: string;
  providers: string[];
  connectionCount: number;
  verifiedConnectionCount: number;
  isDefault?: boolean;
}

export interface IGetCredentialHolderListResponse {
  credentialHolder: ICredentialHolder[];
}
