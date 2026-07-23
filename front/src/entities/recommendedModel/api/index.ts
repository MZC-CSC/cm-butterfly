import { ISourceModelResponse } from '@/entities';
import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import {
  IEsimateCostSpecResponse,
  IRecommendModelResponse,
} from '@/entities/recommendedModel/model/types';

// tb-0.12.9 clean break: removed the old 'RecommendVMInfra' (POST /recommendation/mci) → consolidated into 'RecommendVmInfraCandidates' (POST /recommendation/infra) (cm-beetle BC-6)
const GET_RECOMMEND_MODEL = 'cm-beetle/RecommendVmInfraCandidates';
const GET_RECOMMEND_CANDIDATES = 'cm-beetle/RecommendVmInfraCandidates';
const GET_RECOMMEND_COST = 'cm-ant/Updateandgetestimatecost';

export function useGetRecommendModelListBySourceModel(
  sourceModelInfo: ISourceModelResponse['onpremiseInfraModel'] | null,
  provider: string | null,
  region: string | null,
) {
  const requestWrapper: Required<
    Pick<
      RequestBodyWrapper<{
        desiredCspAndRegionPair: {
          csp: string | null;
          region: string | null;
        };
        onpremiseInfraModel: ISourceModelResponse['onpremiseInfraModel'] | null;
      }>,
      'request'
    >
  > = {
    request: {
      desiredCspAndRegionPair: {
        csp: provider,
        region: region,
      },
      onpremiseInfraModel: sourceModelInfo,
    },
  };
  return useAxiosPost<
    IAxiosResponse<IRecommendModelResponse>,
    Required<
      Pick<
        RequestBodyWrapper<{
          desiredCspAndRegionPair: {
            csp: string | null;
            region: string | null;
          };
          onpremiseInfraModel:
            | ISourceModelResponse['onpremiseInfraModel']
            | null;
        }>,
        'request'
      >
    >
  >(GET_RECOMMEND_MODEL, requestWrapper);
}

export function useGetRecommendModelCandidates(
  sourceModelInfo: ISourceModelResponse['onpremiseInfraModel'] | null,
  provider: string | null,
  region: string | null,
  limit?: number | null,
  minMatchRate?: number | string | null,
) {
  // Build query parameters - convert all to strings (backend's map[string]string)
  const queryParams: Record<string, string> = {};
  if (provider) queryParams.desiredCsp = provider;
  if (region) queryParams.desiredRegion = region;
  if (limit !== null && limit !== undefined) queryParams.limit = String(limit);
  if (minMatchRate !== null && minMatchRate !== undefined) {
    queryParams.minMatchRate = String(minMatchRate);
  }

  const requestWrapper = {
    request: {
      desiredCspAndRegionPair: {
        csp: provider,
        region: region,
      },
      onpremiseInfraModel: sourceModelInfo,
    },
    queryParams: queryParams, // include queryParams in the body
  };

  return useAxiosPost<
    IAxiosResponse<{ data: IRecommendModelResponse[] }>,
    typeof requestWrapper
  >(GET_RECOMMEND_CANDIDATES, requestWrapper);
}

interface ISpecFormat {
  specId: string;
  imageId: string;
}

export function getRecommendCost(specsWithFormat: ISpecFormat[] | null) {
  const requestWrapper: Required<
    Pick<
      RequestBodyWrapper<{ specsWithFormat: ISpecFormat[] | null }>,
      'request'
    >
  > = {
    request: {
      specsWithFormat: specsWithFormat,
    },
  };
  return useAxiosPost<
    IAxiosResponse<IEsimateCostSpecResponse>,
    Required<
      Pick<
        RequestBodyWrapper<{ specsWithFormat: ISpecFormat[] | null }>,
        'request'
      >
    >
  >(GET_RECOMMEND_COST, requestWrapper);
}
