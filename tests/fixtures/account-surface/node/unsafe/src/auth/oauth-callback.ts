// Fixture for the `token-in-localstorage` class. Planted defect, never shipped code.
import { exchangeCode } from './exchange';

export async function handleCallback(code: string) {
  const { accessToken } = await exchangeCode(code);

  // PLANTED: the session token is readable by any script on the origin, so
  // one injected script exfiltrates it.
  window.localStorage.setItem('auth_token', accessToken);

  window.location.assign('/dashboard');
}
