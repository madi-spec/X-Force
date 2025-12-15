/**
 * Microsoft Graph API Client
 * Wrapper for common Graph API operations
 */
export class MicrosoftGraphClient {
  private accessToken: string;
  private baseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `Graph API error: ${response.status}`);
    }

    // Handle empty responses (e.g., DELETE)
    const text = await response.text();
    if (!text) return {} as T;

    return JSON.parse(text);
  }

  // ============================================
  // USER PROFILE
  // ============================================

  async getMe() {
    return this.request<{
      id: string;
      displayName: string;
      mail: string;
      userPrincipalName: string;
    }>('/me');
  }

  // ============================================
  // EMAIL METHODS
  // ============================================

  async getMessages(
    folder: string = 'inbox',
    params: {
      top?: number;
      skip?: number;
      filter?: string;
      select?: string[];
      orderby?: string;
    } = {}
  ) {
    const query = new URLSearchParams();
    if (params.top) query.set('$top', params.top.toString());
    if (params.skip) query.set('$skip', params.skip.toString());
    if (params.filter) query.set('$filter', params.filter);
    if (params.select) query.set('$select', params.select.join(','));
    if (params.orderby) query.set('$orderby', params.orderby);

    const queryString = query.toString();
    const endpoint = `/me/mailFolders/${folder}/messages${queryString ? `?${queryString}` : ''}`;

    return this.request<{
      value: Array<{
        id: string;
        subject: string;
        bodyPreview: string;
        body?: { contentType: string; content: string };
        from?: { emailAddress: { address: string; name?: string } };
        toRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
        ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
        receivedDateTime?: string;
        sentDateTime?: string;
        conversationId?: string;
        isRead?: boolean;
      }>;
      '@odata.nextLink'?: string;
    }>(endpoint);
  }

  async getMessage(messageId: string) {
    return this.request<{
      id: string;
      subject: string;
      bodyPreview: string;
      body: { contentType: string; content: string };
      from: { emailAddress: { address: string; name?: string } };
      toRecipients: Array<{ emailAddress: { address: string; name?: string } }>;
      ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
      receivedDateTime: string;
      conversationId: string;
      isRead: boolean;
    }>(`/me/messages/${messageId}`);
  }

  async sendMessage(message: {
    subject: string;
    body: { contentType: 'Text' | 'HTML'; content: string };
    toRecipients: Array<{ emailAddress: { address: string; name?: string } }>;
    ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  }) {
    return this.request('/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
  }

  async replyToMessage(messageId: string, comment: string) {
    return this.request(`/me/messages/${messageId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  async markAsRead(messageId: string) {
    return this.request(`/me/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    });
  }

  // ============================================
  // CALENDAR METHODS
  // ============================================

  async getCalendarEvents(params: {
    startDateTime: string; // ISO format
    endDateTime: string;
    top?: number;
  }) {
    const query = new URLSearchParams({
      startDateTime: params.startDateTime,
      endDateTime: params.endDateTime,
      $top: (params.top || 50).toString(),
      $orderby: 'start/dateTime',
    });

    return this.request<{
      value: Array<{
        id: string;
        subject: string;
        bodyPreview?: string;
        body?: { contentType: string; content: string };
        start: { dateTime: string; timeZone: string };
        end: { dateTime: string; timeZone: string };
        location?: { displayName: string };
        attendees?: Array<{
          emailAddress: { address: string; name?: string };
          type: 'required' | 'optional';
          status?: { response: string };
        }>;
        isOnlineMeeting?: boolean;
        onlineMeeting?: { joinUrl: string };
        showAs?: string;
        isCancelled?: boolean;
      }>;
    }>(`/me/calendarView?${query}`);
  }

  async getEvent(eventId: string) {
    return this.request<{
      id: string;
      subject: string;
      bodyPreview: string;
      body: { contentType: string; content: string };
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      location?: { displayName: string };
      attendees?: Array<{
        emailAddress: { address: string; name?: string };
        type: 'required' | 'optional';
        status?: { response: string };
      }>;
      isOnlineMeeting?: boolean;
      onlineMeeting?: { joinUrl: string };
    }>(`/me/events/${eventId}`);
  }

  async createEvent(event: {
    subject: string;
    body?: { contentType: 'Text' | 'HTML'; content: string };
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    attendees?: Array<{
      emailAddress: { address: string; name?: string };
      type: 'required' | 'optional';
    }>;
    isOnlineMeeting?: boolean;
    onlineMeetingProvider?: 'teamsForBusiness';
  }) {
    return this.request<{ id: string; webLink: string }>('/me/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateEvent(
    eventId: string,
    updates: Partial<{
      subject: string;
      body: { contentType: 'Text' | 'HTML'; content: string };
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      attendees: Array<{
        emailAddress: { address: string; name?: string };
        type: 'required' | 'optional';
      }>;
    }>
  ) {
    return this.request(`/me/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteEvent(eventId: string) {
    return this.request(`/me/events/${eventId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // ONEDRIVE METHODS (for future recordings support)
  // ============================================

  async getRecentFiles(top: number = 25) {
    return this.request<{
      value: Array<{
        id: string;
        name: string;
        webUrl: string;
        createdDateTime: string;
        lastModifiedDateTime: string;
        size: number;
      }>;
    }>(`/me/drive/recent?$top=${top}`);
  }

  async searchFiles(query: string) {
    return this.request<{
      value: Array<{
        id: string;
        name: string;
        webUrl: string;
      }>;
    }>(`/me/drive/root/search(q='${encodeURIComponent(query)}')`);
  }
}
