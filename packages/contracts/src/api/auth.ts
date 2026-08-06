export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ApiAuthResponse {
  user: ApiUser;
}

export interface ApiHealth {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
