import { IUserLoginResponse } from '@/entities/user/model/types';
import { useAuthStore } from '@/shared/libs/store/auth';
import JwtTokenProvider from '@/shared/libs/token';
import LocalStorageConnector from '@/shared/libs/access-localstorage/localStorageConnector';
import { startSessionExpiryWatch } from '@/features/auth/model/useLogout';
import { markSessionStart } from '@/shared/libs/auth/session';

const LOGIN_AUTH = 'LOGIN_AUTH';

export function useAuth() {
  const jwtTokenProvider = JwtTokenProvider.getProvider();
  const localStorageConnector = new LocalStorageConnector<
    Pick<IUserLoginResponse, 'role' | 'expires_in'> & { id: string }
  >(LOGIN_AUTH);

  const authStore = useAuthStore();

  function setUser(props: IUserLoginResponse & { id: string }) {
    jwtTokenProvider.setTokens({
      refresh_token: props.refresh_token || '',
      access_token: props.access_token || '',
    });

    // const decodedToken = jwtTokenProvider.parseAccessToken();
    // props.role = decodedToken.realm_access.roles[0];
    //TODO role management logic
    // role = decodedToken.realm_access.roles[0];
    const userData = {
      id: props.id,
      role: props.role,
      expires_in: props.expires_in,
    };
    localStorageConnector.setItem(userData);
    authStore.onLogin(props);
    // We need the start time to cap how long the session can be extended.
    markSessionStart();
    // Watch for expiry so we catch it even while the user stays on the page.
    startSessionExpiryWatch();
  }

  function getUser(): Omit<
    IUserLoginResponse,
    'expires_in' | 'refresh_expires_in'
  > & {
    id: string;
    role: string;
    isLogin: boolean;
  } {
    return { ...authStore.$state, ...jwtTokenProvider.getTokens() };
  }

  function loadUser() {
    let role = '';

    // const decodedToken = jwtTokenProvider.parseAccessToken();
    // console.log(decodedToken);
    //TODO role management logic
    // role = decodedToken.realm_access.roles[0];
    role = 'admin';
    const storeValue = localStorageConnector.getValue();

    const userData = {
      id: storeValue?.id || '',
      role: role,
      expires_in: storeValue?.expires_in || '',
    };

    authStore.onLogin(userData);
  }

  return { sessionUser: localStorageConnector, setUser, getUser, loadUser };
}
