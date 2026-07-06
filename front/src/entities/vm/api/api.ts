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

const RUN_LOAD_TEST = 'Runloadtest';
const STOP_LOAD_TEST = 'StopLoadTest';
const GET_LOAD_TEST_INFO = 'GetLoadTestExecutionInfo';
const GET_LAST_LOAD_TEST_CONFIG = 'Getlastloadtestexecutionstate';
const GET_LOAD_TEST_EVALUATION_DATA = 'Getlastloadtestresult';
const GET_LOAD_TEST_RESOURCE_METRIC = 'Getlastloadtestmetrics';

// Load Test Scenario Catalog API endpoints
const GET_ALL_LOAD_TEST_SCENARIO_CATALOGS = 'GetAllLoadTestScenarioCatalogs';
const GET_LOAD_TEST_SCENARIO_CATALOG = 'GetLoadTestScenarioCatalog';
const CREATE_LOAD_TEST_SCENARIO_CATALOG = 'CreateLoadTestScenarioCatalog';
const UPDATE_LOAD_TEST_SCENARIO_CATALOG = 'UpdateLoadTestScenarioCatalog';
const DELETE_LOAD_TEST_SCENARIO_CATALOG = 'DeleteLoadTestScenarioCatalog';

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

// 진행 중인 부하테스트 중단(StopLoadTest). loadTestKey로 지정.
export function useStopLoadTest(loadTestKey: string | null) {
  const requestBodyWrapper: Required<
    Pick<RequestBodyWrapper<{ loadTestKey: string } | null>, 'request'>
  > = {
    request: loadTestKey ? { loadTestKey } : null,
  };

  return useAxiosPost<
    IAxiosResponse<unknown>,
    Required<Pick<RequestBodyWrapper<{ loadTestKey: string } | null>, 'request'>>
  >(STOP_LOAD_TEST, requestBodyWrapper);
}

// 부하테스트 실행 정보 조회(GetLoadTestExecutionInfo, infos/{loadTestKey}) —
// Re-run 시 마지막 실행 파라미터로 Load Config를 pre-fill 하기 위해 사용.
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
 * 모든 로드 테스트 시나리오 카탈로그를 조회합니다.
 */
export function useGetAllLoadTestScenarioCatalogs() {
  return useAxiosPost<IAxiosResponse<ILoadTestScenarioCatalogsResponse>, null>(
    GET_ALL_LOAD_TEST_SCENARIO_CATALOGS,
    null,
  );
}

/**
 * Get a specific load test scenario catalog by ID
 * ID로 특정 로드 테스트 시나리오 카탈로그를 조회합니다.
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
 * 새로운 로드 테스트 시나리오 카탈로그를 생성합니다.
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
 * 로드 테스트 시나리오 카탈로그를 업데이트합니다.
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
 * 로드 테스트 시나리오 카탈로그를 삭제합니다.
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
