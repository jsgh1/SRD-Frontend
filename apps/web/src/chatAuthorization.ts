import { ApiError } from './api';

export function reportAuthorizationLoss(error: unknown) {
  if (error instanceof ApiError && [401, 403].includes(error.status)) {
    document.dispatchEvent(new Event('srd-chat-auth-lost'));
  }
}
