import {
  IAxiosResponse,
  RequestBodyWrapper,
  useAxiosPost,
} from '@/shared/libs';
import {
  IGetCredentialListResponse,
  ICreateCredentialsPayload,
  IGetProviderListResponse,
  ICloudOsMetaInfoResponse,
  IRegisterCredentialPayload,
  IRegisterCredentialResponse,
  IGetCredentialHolderListResponse,
} from '@/entities/credentials/model/types';

const GET_CREDENTIAL = 'cb-spider/List-Credential';
const CREATE_CREDENTIAL = 'cb-spider/Register-Credential';
const DELETE_CREDENTIAL = 'cb-spider/Unregister-Credential';

// Registration goes through cb-tumblebug rather than cb-spider. cb-tumblebug takes
// the values encrypted (our api seals them on the way out) and, on success, creates
// the driver, region and connection configs that make the credential usable -
// registering with cb-spider alone leaves a credential nothing refers to.
const GET_PROVIDER_LIST = 'cb-tumblebug/GetProviderList';
const FORWARD_TO_SPIDER = 'cb-tumblebug/ForwardAnyReqToAny';
const REGISTER_CREDENTIAL = 'cb-tumblebug/RegisterCredential';
const GET_CREDENTIAL_HOLDER_LIST = 'cb-tumblebug/GetCredentialHolderList';

export function useGetProviderList() {
  return useAxiosPost<IAxiosResponse<IGetProviderListResponse>, object>(
    GET_PROVIDER_LIST,
    {},
  );
}

// The field names a CSP requires are asked for, never assumed. cb-spider answers
// with the list for that provider, and the form is built from whatever comes back -
// so a provider gaining or renaming a field needs no change here.
export function useGetCredentialFieldSpec(provider: string) {
  const requestWrapper: Required<
    Pick<
      RequestBodyWrapper<Record<string, never>>,
      'pathParams' | 'request'
    >
  > = {
    pathParams: { path: `cloudos/metainfo/${provider}` },
    request: {},
  };

  return useAxiosPost<
    IAxiosResponse<ICloudOsMetaInfoResponse>,
    typeof requestWrapper
  >(FORWARD_TO_SPIDER, requestWrapper);
}

export function useRegisterCredential() {
  return useAxiosPost<
    IAxiosResponse<IRegisterCredentialResponse>,
    Required<Pick<RequestBodyWrapper<IRegisterCredentialPayload>, 'request'>>
  >(REGISTER_CREDENTIAL, {
    request: {
      providerName: '',
      credentialHolder: '',
      credentialKeyValueList: [],
    },
  });
}

export function useGetCredentialHolderList() {
  return useAxiosPost<IAxiosResponse<IGetCredentialHolderListResponse>, object>(
    GET_CREDENTIAL_HOLDER_LIST,
    {},
  );
}

export function useGetCredentialList() {
  return useAxiosPost<IAxiosResponse<IGetCredentialListResponse>, null>(
    GET_CREDENTIAL,
    null,
  );
}

export type ICreateCredentialsResponse = ICreateCredentialsPayload;

export function useCreateCredentials(data: ICreateCredentialsPayload | null) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<ICreateCredentialsPayload | null>, 'request'>
  > = {
    request: data,
  };

  return useAxiosPost<
    IAxiosResponse<ICreateCredentialsResponse>,
    Required<
      Pick<RequestBodyWrapper<ICreateCredentialsPayload | null>, 'request'>
    >
  >(CREATE_CREDENTIAL, requestWrapper);
}

export function useDeleteCredentials(credentialName: string | null) {
  const requestWrapper: Required<
    Pick<RequestBodyWrapper<{ CredentialName: string | null }>, 'pathParams'>
  > = {
    pathParams: {
      CredentialName: credentialName,
    },
  };

  return useAxiosPost<
    IAxiosResponse<{ Result: string }>,
    Required<
      Pick<RequestBodyWrapper<{ CredentialName: string | null }>, 'pathParams'>
    >
  >(DELETE_CREDENTIAL, requestWrapper);
}
