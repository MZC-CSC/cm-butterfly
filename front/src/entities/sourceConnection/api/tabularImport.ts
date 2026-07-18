import { IAxiosResponse, useAxiosPost } from '@/shared/libs';

/**
 * Parsing runs on the server so that quoted commas, embedded newlines and byte
 * order marks are handled to spec, and so Excel workbooks can be read without
 * pulling a parser into the browser bundle. The endpoint only turns a file into
 * rows — validation stays in the console.
 */
const PARSE_TABULAR_IMPORT = 'parsetabularimport';

export interface ITabularImportRequest {
  fileName: string;
  /** CSV text. */
  content?: string;
  /** Binary content (Excel) as base64. */
  contentBase64?: string;
}

export interface ITabularImportRow {
  index: number;
  data: Record<string, string>;
}

export interface ITabularImportResult {
  format: string;
  headers: string[];
  rows: ITabularImportRow[];
  /** Problems with the file as a whole, such as a ragged row. */
  fileErrors: string[];
}

export function useParseTabularImport() {
  return useAxiosPost<
    IAxiosResponse<ITabularImportResult>,
    ITabularImportRequest | null
  >(PARSE_TABULAR_IMPORT, null);
}
