import { IAxiosResponse, useAxiosPost } from '@/shared/libs';

/**
 * The file is built on the server, next to the import parser, so both
 * directions share one column contract. Encrypted fields have no place in the
 * request: the server cannot write what it never receives.
 */
const EXPORT_TABULAR_CONNECTIONS = 'exporttabularconnections';

/** Only the columns the server is allowed to write out. */
export interface ITabularExportConnection {
  name: string;
  description: string;
  ip_address: string;
  ssh_port: string;
}

export interface ITabularExportRequest {
  /** Currently only 'csv'. */
  format: string;
  connections: ITabularExportConnection[];
}

export interface ITabularExportResult {
  format: string;
  /** File bytes as base64, so a binary format can be added without a change here. */
  contentBase64: string;
}

export function useExportTabularConnections() {
  return useAxiosPost<
    IAxiosResponse<ITabularExportResult>,
    ITabularExportRequest | null
  >(EXPORT_TABULAR_CONNECTIONS, null);
}
