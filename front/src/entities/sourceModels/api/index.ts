import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import { ISourceModelResponse } from '@/entities/sourceModels/model/types';

const GET_MODELS = 'cm-damselfly/GetModels';

/**
 * The Source Models list shows source and planning models together: a planning model is the plan
 * of a source model. cm-damselfly's GetModels takes one stage per call, so the list calls it once
 * per stage in SOURCE_LIST_STAGES and joins the results, with the category filter sent along.
 */
export const SOURCE_LIST_STAGES = ['source', 'planning'] as const;

export function useGetSourceModelList() {
  const requestWrapper: Required<Pick<RequestBodyWrapper<any>, 'queryParams'>> =
    {
      queryParams: { modelStage: 'source' },
    };
  return useAxiosPost<
    IAxiosResponse<ISourceModelResponse[]>,
    Required<Pick<RequestBodyWrapper<any>, 'queryParams'>>
  >(GET_MODELS, requestWrapper);
}
