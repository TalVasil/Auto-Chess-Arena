const API_URL = 'http://localhost:2567/api/auth';

export interface AuthResponse {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: {
    userId: number;
    username: string;
    displayName: string;
    canEdit?: boolean;
  };
  error?: string;
  message?: string;
}

export const authService = {
  /**
   * Register a new user
   */
  async register(
    username: string,
    password: string,
    email: string,
    displayName: string
  ): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email, displayName }),
    });
    return response.json();
  },

  /**
   * Login with username and password
   */
  async login(
    username: string,
    password: string,
    rememberMe: boolean
  ): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, rememberMe }),
    });
    return response.json();
  },

  /**
   * Verify refresh token for auto-login
   */
  async verifyToken(token: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return response.json();
  },

  /**
   * Logout and delete refresh token
   */
  async logout(token: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return response.json();
  },

  /**
   * Request password recovery email
   */
  async forgotPassword(email: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return response.json();
  },

  /**
   * Check if username is available
   */
  async checkUsername(username: string): Promise<{ success: boolean; available: boolean }> {
    const response = await fetch(`${API_URL}/check-username/${encodeURIComponent(username)}`);
    return response.json();
  },

  /**
   * Check if email is available
   */
  async checkEmail(email: string): Promise<{ success: boolean; available: boolean }> {
    const response = await fetch(`${API_URL}/check-email/${encodeURIComponent(email)}`);
    return response.json();
  },

  /**
   * Check if password is already used
   */
  async checkPassword(password: string): Promise<{ success: boolean; available: boolean }> {
    const response = await fetch(`${API_URL}/check-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return response.json();
  },
};
