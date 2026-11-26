import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import { ISourceModelResponse } from '@/entities/sourceModels/model/types';

const GET_MODELS = 'cm-damselfly/GetModels';

/**
 * The Source Models list shows source and planning models together: a planning model is the plan
 * of a source model. GetModels takes several stages separated by commas, so the list asks for
 * both in one call, with the category filter sent along.
 */
export const SOURCE_LIST_STAGES = 'source,planning';

export function useGetSourceModelList() {
  const requestWrapper: Required<Pick<RequestBodyWrapper<any>, 'queryParams'>> =
    {
      queryParams: { modelStage: SOURCE_LIST_STAGES },
    };
  return useAxiosPost<
    IAxiosResponse<ISourceModelResponse[]>,
    Required<Pick<RequestBodyWrapper<any>, 'queryParams'>>
  >(GET_MODELS, requestWrapper);
}
