import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import { ITargetModelResponse } from '@/entities/targetModels/model/types';

const GET_MODELS = 'cm-damselfly/GetModels';

export function useGetTargetModelList() {
  const requestWrapper: Required<Pick<RequestBodyWrapper<any>, 'queryParams'>> =
    {
      queryParams: { modelStage: 'target' },
    };
  return useAxiosPost<
    IAxiosResponse<ITargetModelResponse[]>,
    Required<Pick<RequestBodyWrapper<any>, 'queryParams'>>
  >(GET_MODELS, requestWrapper);
}
