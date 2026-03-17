import { requestCommunity } from './communityClient';

export async function apiGet(path) {
  return requestCommunity(path, { method: 'GET', cache: 'no-store' });
}
