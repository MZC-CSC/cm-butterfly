import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import { ISourceModelResponse } from '@/entities/sourceModels/model/types';

const GET_MODELS = 'cm-damselfly/GetModels';

/**
 * Source and planning models. The Source Models list shows both: a planning model is a source model
 * the user has edited, and it is what a recommendation is run from. GetModels takes one stage at a
 * time, so the list asks for every stage and keeps the two (see `isSourceSideModel`).
 */
export function useGetSourceModelList() {
  const requestWrapper: Required<Pick<RequestBodyWrapper<any>, 'queryParams'>> =
    {
      queryParams: {},
    };
  return useAxiosPost<
    IAxiosResponse<ISourceModelResponse[]>,
    Required<Pick<RequestBodyWrapper<any>, 'queryParams'>>
  >(GET_MODELS, requestWrapper);
}

export function isSourceSideModel(model: { modelStage?: string }) {
  return model.modelStage === 'source' || model.modelStage === 'planning';
}
