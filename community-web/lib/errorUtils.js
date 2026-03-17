import { CommunityApiError } from './communityClient';

export function toUserErrorMessage(error, fallback = 'Request failed.') {
  if (!error) return fallback;

  if (error instanceof CommunityApiError) {
    if (error.details && typeof error.details === 'object' && typeof error.details.error === 'string') {
      return error.details.error;
    }
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
    return fallback;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
