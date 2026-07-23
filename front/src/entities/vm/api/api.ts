import {
  ILastloadtestStateResponse,
  IRunLoadTestRequest,
} from '@/entities/mci/model';
import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import { IMciRequestParams } from '@/entities/mci/api';
import {
  IGetlastloadtestmetricsResponse,
  IGetLoadTestEvaluationDataResponse,
  ILoadTestResultAggregateResponse,
} from '@/entities/workspace/model/types';
import {
  ILoadTestScenarioCatalog,
  ILoadTestScenarioCatalogsResponse,
  ICreateLoadTestScenarioCatalogRequest,
  IUpdateLoadTestScenarioCatalogRequest,
} from '@/entities/vm/model/types';

const RUN_LOAD_TEST = 'cm-ant/Runloadtest';
const STOP_LOAD_TEST = 'cm-ant/StopLoadTest';
const GET_LOAD_TEST_INFO = 'cm-ant/GetLoadTestExecutionInfo';
const GET_LAST_LOAD_TEST_CONFIG = 'cm-ant/Getlastloadtestexecutionstate';
// Looks up exactly that run by its execution key. Unlike a name-based "last run", the
// target cannot change underneath.
const GET_LOAD_TEST_STATE_BY_KEY = 'cm-ant/GetLoadTestExecutionState';
const GET_LOAD_TEST_EVALUATION_DATA = 'cm-ant/Getlastloadtestresult';
const GET_LOAD_TEST_RESOURCE_METRIC = 'cm-ant/Getlastloadtestmetrics';

// Load Test Scenario Catalog API endpoints
const GET_ALL_LOAD_TEST_SCENARIO_CATALOGS =
  'cm-ant/GetAllLoadTestScenarioCatalogs';
const GET_LOAD_TEST_SCENARIO_CATALOG = 'cm-ant/GetLoadTestScenarioCatalog';
const CREATE_LOAD_TEST_SCENARIO_CATALOG =
  'cm-ant/CreateLoadTestScenarioCatalog';
const UPDATE_LOAD_TEST_SCENARIO_CATALOG =
  'cm-ant/UpdateLoadTestScenarioCatalog';
const DELETE_LOAD_TEST_SCENARIO_CATALOG =
  'cm-ant/DeleteLoadTestScenarioCatalog';

export function useRunLoadTest(requestPayload: IRunLoadTestRequest | null) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<IRunLoadTestRequest | null>, 'request'>
  > = {
    request: requestPayload,
  };

  return useAxiosPost<
    IAxiosResponse<IRunLoadTestRequest>,
    Required<Pick<RequestBodyWrapper<IMciRequestParams | null>, 'request'>>
  >(RUN_LOAD_TEST, requestBodyWrapper);
}

// Stop a running load test (StopLoadTest). Identified by loadTestKey.
export function useStopLoadTest(loadTestKey: string | null) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<{ loadTestKey: string } | null>, 'request'>
  > = {
    request: loadTestKey ? { loadTestKey } : null,
  };

  return useAxiosPost<
    IAxiosResponse<unknown>,
    Required<
      Pick<RequestBodyWrapper<{ loadTestKey: string } | null>, 'request'>
    >
  >(STOP_LOAD_TEST, requestBodyWrapper);
}

// Fetch load test execution info (GetLoadTestExecutionInfo, infos/{loadTestKey}) —
// used to pre-fill the Load Config with the last run's parameters on Re-run.
export interface ILoadTestExecutionHttpInfo {
  method?: string;
  protocol?: string;
  hostname?: string;
  port?: string;
  path?: string;
  bodyData?: string;
}

export interface ILoadTestExecutionInfoResult {
  loadTestKey?: string;
  testName?: string;
  virtualUsers?: string;
  duration?: string;
  rampUpTime?: string;
  rampUpSteps?: string;
  loadTestExecutionHttpInfos?: ILoadTestExecutionHttpInfo[];
}

export function useGetLoadTestInfo(loadTestKey: string | null) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<{ loadTestKey: string | null }>, 'pathParams'>
  > = {
    pathParams: {
      loadTestKey: loadTestKey || null,
    },
  };

  return useAxiosPost<
    IAxiosResponse<ILoadTestExecutionInfoResult>,
    Required<
      Pick<RequestBodyWrapper<{ loadTestKey: string | null }>, 'pathParams'>
    >
  >(GET_LOAD_TEST_INFO, requestBodyWrapper);
}

interface ILastloadtestStateResponseWrapper {
  result: ILastloadtestStateResponse;
}

export function useGetLastLoadTestState(
  params: IMciRequestParams | { nodeId: string } | null,
) {
  const requestBodyWrapper: Required<
    Pick<
      RequestBodyWrapper<IMciRequestParams | { nodeId: string } | null>,
      'request'
    >
  > = {
    request: params,
  };

  return useAxiosPost<
    IAxiosResponse<ILastloadtestStateResponseWrapper>,
    Required<
      Pick<
        RequestBodyWrapper<IMciRequestParams | { nodeId: string } | null>,
        'request'
      >
    >
  >(GET_LAST_LOAD_TEST_CONFIG, requestBodyWrapper);
}

/**
 * Reads load test state by execution key.
 *
 * This differs from asking for "the last run" by name (ns/infra/node) in the way that
 * matters: names are reused, so that question can start answering with another VM's run.
 * An execution key names one run and nothing else.
 */
export function useGetLoadTestStateByKey(loadTestKey: string) {
  return useAxiosPost<IAxiosResponse<ILastloadtestStateResponseWrapper>, any>(
    GET_LOAD_TEST_STATE_BY_KEY,
    { pathParams: { loadTestKey } },
  );
}

interface IMetricParams extends IMciRequestParams {
  nodeId: string;
  format: 'normal';
}

interface IMetricParamsBase extends IMciRequestParams {
  nodeId: string;
}

type FormatType = 'normal' | 'aggregate';

export function useGetLoadTestEvaluationData<T extends FormatType>(
  params: (IMetricParamsBase & { format: T }) | null,
) {
  const requestBodyWrapper: Required<
    Pick<
      RequestBodyWrapper<(IMetricParamsBase & { format: T }) | null>,
      'queryParams'
    >
  > = {
    queryParams: params,
  };

  type ResponseType = T extends 'normal'
    ? IGetLoadTestEvaluationDataResponse
    : ILoadTestResultAggregateResponse;

  return useAxiosPost<
    IAxiosResponse<ResponseType>,
    Required<
      Pick<
        RequestBodyWrapper<(IMetricParamsBase & { format: T }) | null>,
        'queryParams'
      >
    >
  >(GET_LOAD_TEST_EVALUATION_DATA, requestBodyWrapper);
}

export function useGetLoadTestResourceMetric(params: IMetricParams | null) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<IMetricParams | null>, 'queryParams'>
  > = {
    queryParams: params,
  };

  return useAxiosPost<
    IAxiosResponse<IGetlastloadtestmetricsResponse>,
    Required<Pick<RequestBodyWrapper<IMetricParams | null>, 'queryParams'>>
  >(GET_LOAD_TEST_RESOURCE_METRIC, requestBodyWrapper);
}

// Load Test Scenario Catalog API Functions

/**
 * Get all load test scenario catalogs
 */
export function useGetAllLoadTestScenarioCatalogs() {
  return useAxiosPost<IAxiosResponse<ILoadTestScenarioCatalogsResponse>, null>(
    GET_ALL_LOAD_TEST_SCENARIO_CATALOGS,
    null,
  );
}

/**
 * Get a specific load test scenario catalog by ID
 */
export function useGetLoadTestScenarioCatalog(catalogId: number | null) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<{ id: string | null }>, 'pathParams'>
  > = {
    pathParams: {
      id: catalogId?.toString() || null,
    },
  };

  return useAxiosPost<
    IAxiosResponse<ILoadTestScenarioCatalog>,
    Required<Pick<RequestBodyWrapper<{ id: string | null }>, 'pathParams'>>
  >(GET_LOAD_TEST_SCENARIO_CATALOG, requestBodyWrapper);
}

/**
 * Create a new load test scenario catalog
 */
export function useCreateLoadTestScenarioCatalog(
  data: ICreateLoadTestScenarioCatalogRequest | null,
) {
  const requestBodyWrapper: Required<
    Pick<
      RequestBodyWrapper<ICreateLoadTestScenarioCatalogRequest | null>,
      'request'
    >
  > = {
    request: data,
  };

  return useAxiosPost<
    IAxiosResponse<ILoadTestScenarioCatalog>,
    Required<
      Pick<
        RequestBodyWrapper<ICreateLoadTestScenarioCatalogRequest | null>,
        'request'
      >
    >
  >(CREATE_LOAD_TEST_SCENARIO_CATALOG, requestBodyWrapper);
}

/**
 * Update a load test scenario catalog
 */
export function useUpdateLoadTestScenarioCatalog(
  catalogId: number | null,
  data: IUpdateLoadTestScenarioCatalogRequest | null,
) {
  const requestBodyWrapper: Required<
    Pick<
      RequestBodyWrapper<{
        id: string | null;
      }>,
      'pathParams'
    > &
      Pick<
        RequestBodyWrapper<IUpdateLoadTestScenarioCatalogRequest | null>,
        'request'
      > &
      Pick<RequestBodyWrapper<any>, 'queryParams'>
  > = {
    pathParams: {
      id: catalogId?.toString() || null,
    },
    queryParams: {},
    request: data,
  };

  return useAxiosPost<
    IAxiosResponse<ILoadTestScenarioCatalog>,
    Required<
      Pick<
        RequestBodyWrapper<{
          id: string | null;
        }>,
        'pathParams'
      > &
        Pick<
          RequestBodyWrapper<IUpdateLoadTestScenarioCatalogRequest | null>,
          'queryParams'
        > &
        Pick<RequestBodyWrapper<any>, 'request'>
    >
  >(UPDATE_LOAD_TEST_SCENARIO_CATALOG, requestBodyWrapper);
}

/**
 * Delete a load test scenario catalog
 */
export function useDeleteLoadTestScenarioCatalog(catalogId: number | null) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<{ id: string | null }>, 'pathParams'> &
      Pick<RequestBodyWrapper<any>, 'queryParams' | 'request'>
  > = {
    pathParams: {
      id: catalogId?.toString() || null,
    },
    queryParams: {},
    request: null,
  };

  return useAxiosPost<
    IAxiosResponse<any>,
    Required<
      Pick<RequestBodyWrapper<{ id: string | null }>, 'pathParams'> &
        Pick<RequestBodyWrapper<any>, 'queryParams' | 'request'>
    >
  >(DELETE_LOAD_TEST_SCENARIO_CATALOG, requestBodyWrapper);
}
