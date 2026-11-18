const API_BASE_URL = 'http://localhost:4000/api';

export class ApiClient {
  private static async getToken(): Promise<string | null> {
    const res = await chrome.storage.local.get(['authToken']);
    return res.authToken || null;
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Auth
  static async devLogin(email?: string, name?: string) {
    const data = await this.request<{ user: any; token: string }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
    await chrome.storage.local.set({ authToken: data.token, user: data.user });
    return data;
  }

  static async getMe() {
    return this.request<{ user: any }>('/auth/me');
  }

  // Resume / Screening
  static async getResume() {
    return this.request<{ profile: any }>('/resume');
  }

  static async answerScreening(question: string) {
    return this.request<{ answer: string | number | boolean; confidence: number }>('/resume/screening-answer', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  }

  // Jobs Tracking
  static async getJobs() {
    return this.request<{ applications: any[]; summary: any }>('/jobs');
  }

  static async recordApplication(jobData: any) {
    return this.request<{ success: boolean; job: any }>('/jobs/apply', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  // Gmail Sync
  static async syncEmails() {
    return this.request<{ success: boolean; count: number; emails: any[] }>('/gmail/sync', {
      method: 'POST',
    });
  }

  static async getEmails() {
    return this.request<{ emails: any[] }>('/gmail/emails');
  }

  // Feedback Request
  static async requestFeedback(jobId: string, recruiterEmail?: string) {
    return this.request<{ success: boolean; message: string; reviewId?: string }>('/feedback/request', {
      method: 'POST',
      body: JSON.stringify({ jobId, recruiterEmail }),
    });
  }
}
