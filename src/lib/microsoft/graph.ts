/**
 * Microsoft Graph API Client
 * Wrapper for common Graph API operations
 */
export class MicrosoftGraphClient {
  private accessToken: string;
  private baseUrl = 'https://graph.microsoft.com/v1.0';
  private useImmutableIds: boolean;

  constructor(accessToken: string, options?: { useImmutableIds?: boolean }) {
    this.accessToken = accessToken;
    this.useImmutableIds = options?.useImmutableIds ?? true; // Default to immutable IDs
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const customHeaders = (options.headers as Record<string, string>) || {};
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    // Build Prefer header - combine multiple preferences if needed
    const preferParts: string[] = [];

    // Add immutable IDs preference for email operations
    if (this.useImmutableIds) {
      preferParts.push('IdType="ImmutableId"');
    }

    // Add any custom Prefer header (e.g., timezone for calendar)
    if (customHeaders['Prefer']) {
      preferParts.push(customHeaders['Prefer']);
      delete customHeaders['Prefer']; // Remove so we don't duplicate
    }

    if (preferParts.length > 0) {
      headers['Prefer'] = preferParts.join(', ');
    }

    // Add remaining custom headers
    Object.assign(headers, customHeaders);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
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

  async searchAllMessages(params: {
    filter?: string;
    select?: string[];
    top?: number;
    orderby?: string;
  } = {}) {
    const query = new URLSearchParams();
    if (params.top) query.set('$top', params.top.toString());
    if (params.filter) query.set('$filter', params.filter);
    if (params.select) query.set('$select', params.select.join(','));
    if (params.orderby) query.set('$orderby', params.orderby);

    const queryString = query.toString();
    const endpoint = `/me/messages${queryString ? `?${queryString}` : ''}`;

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
        internetMessageId?: string;
        isRead?: boolean;
        hasAttachments?: boolean;
        importance?: string;
        flag?: { flagStatus: string };
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

  async moveMessage(messageId: string, destinationFolderId: string) {
    return this.request<{ id: string }>(`/me/messages/${messageId}/move`, {
      method: 'POST',
      body: JSON.stringify({ destinationId: destinationFolderId }),
    });
  }

  async flagMessage(messageId: string, flagStatus: 'flagged' | 'complete' | 'notFlagged') {
    return this.request(`/me/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ flag: { flagStatus } }),
    });
  }

  /**
   * Add categories (labels) to a message
   * Categories appear as colored tags in Outlook
   */
  async setCategoryOnMessage(messageId: string, categories: string[]) {
    return this.request(`/me/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ categories }),
    });
  }

  /**
   * Add a single category to a message (preserving existing categories)
   */
  async addCategoryToMessage(messageId: string, category: string) {
    // First get existing categories
    const message = await this.request<{ categories: string[] }>(
      `/me/messages/${messageId}?$select=categories`
    );
    const existingCategories = message.categories || [];

    // Add new category if not already present
    if (!existingCategories.includes(category)) {
      existingCategories.push(category);
      await this.setCategoryOnMessage(messageId, existingCategories);
    }
  }

  // ============================================
  // FOLDER METHODS
  // ============================================

  async getMailFolders() {
    return this.request<{
      value: Array<{
        id: string;
        displayName: string;
        parentFolderId: string;
        childFolderCount: number;
        totalItemCount: number;
        unreadItemCount: number;
      }>;
    }>('/me/mailFolders');
  }

  async getMailFolder(folderIdOrName: string) {
    return this.request<{
      id: string;
      displayName: string;
      parentFolderId: string;
      totalItemCount: number;
      unreadItemCount: number;
    }>(`/me/mailFolders/${folderIdOrName}`);
  }

  async createMailFolder(displayName: string, parentFolderId?: string) {
    const endpoint = parentFolderId
      ? `/me/mailFolders/${parentFolderId}/childFolders`
      : '/me/mailFolders';

    return this.request<{ id: string; displayName: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    });
  }

  async findOrCreateFolder(displayName: string): Promise<string> {
    // Try to find existing folder
    const folders = await this.getMailFolders();
    const existing = folders.value.find(
      (f) => f.displayName.toLowerCase() === displayName.toLowerCase()
    );
    if (existing) return existing.id;

    // Create new folder
    const created = await this.createMailFolder(displayName);
    return created.id;
  }

  // ============================================
  // DELTA SYNC (for incremental updates)
  // ============================================

  async getMessagesDelta(deltaLink?: string) {
    const endpoint = deltaLink
      ? deltaLink.replace('https://graph.microsoft.com/v1.0', '')
      : '/me/mailFolders/inbox/messages/delta?$select=id,conversationId,internetMessageId,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isRead,hasAttachments,bodyPreview,importance,flag';

    return this.request<{
      value: Array<{
        id: string;
        conversationId?: string;
        internetMessageId?: string;
        subject?: string;
        bodyPreview?: string;
        from?: { emailAddress: { address: string; name?: string } };
        toRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
        ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
        receivedDateTime?: string;
        sentDateTime?: string;
        isRead?: boolean;
        hasAttachments?: boolean;
        importance?: string;
        flag?: { flagStatus: string };
        '@removed'?: { reason: string };
      }>;
      '@odata.nextLink'?: string;
      '@odata.deltaLink'?: string;
    }>(endpoint);
  }

  async getSentMessagesDelta(deltaLink?: string) {
    const endpoint = deltaLink
      ? deltaLink.replace('https://graph.microsoft.com/v1.0', '')
      : '/me/mailFolders/sentitems/messages/delta?$select=id,conversationId,internetMessageId,subject,from,toRecipients,ccRecipients,sentDateTime,hasAttachments,bodyPreview,importance';

    return this.request<{
      value: Array<{
        id: string;
        conversationId?: string;
        internetMessageId?: string;
        subject?: string;
        bodyPreview?: string;
        from?: { emailAddress: { address: string; name?: string } };
        toRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
        ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
        sentDateTime?: string;
        hasAttachments?: boolean;
        importance?: string;
        '@removed'?: { reason: string };
      }>;
      '@odata.nextLink'?: string;
      '@odata.deltaLink'?: string;
    }>(endpoint);
  }

  // ============================================
  // WEBHOOK SUBSCRIPTIONS
  // ============================================

  async createSubscription(resource: string, changeType: string, notificationUrl: string, expirationDateTime: string) {
    return this.request<{
      id: string;
      resource: string;
      changeType: string;
      expirationDateTime: string;
    }>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        changeType,
        notificationUrl,
        resource,
        expirationDateTime,
        clientState: 'xforce-inbox-webhook',
      }),
    });
  }

  async renewSubscription(subscriptionId: string, expirationDateTime: string) {
    return this.request<{ id: string; expirationDateTime: string }>(
      `/subscriptions/${subscriptionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ expirationDateTime }),
      }
    );
  }

  async deleteSubscription(subscriptionId: string) {
    return this.request(`/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // CALENDAR METHODS
  // ============================================

  async getCalendarEvents(params: {
    startDateTime: string; // ISO format or YYYY-MM-DDTHH:mm:ss
    endDateTime: string;
    top?: number;
    timezone?: string;
  }) {
    const query = new URLSearchParams({
      startDateTime: params.startDateTime,
      endDateTime: params.endDateTime,
      $top: (params.top || 50).toString(),
      $orderby: 'start/dateTime',
      $select: 'id,subject,start,end,attendees,isOnlineMeeting,onlineMeeting,showAs,isCancelled,location',
    });

    // Add timezone preference header
    const headers: Record<string, string> = {};
    if (params.timezone) {
      headers['Prefer'] = `outlook.timezone="${params.timezone}"`;
    }

    console.log('[Graph] Calendar query:', {
      url: `/me/calendarView?${query}`,
      timezone: params.timezone,
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
    }>(`/me/calendarView?${query}`, { headers });
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

  /**
   * Get free/busy schedule for multiple users
   * Uses the /me/calendar/getSchedule endpoint
   */
  async getSchedule(params: {
    schedules: string[]; // Array of email addresses
    startTime: { dateTime: string; timeZone: string };
    endTime: { dateTime: string; timeZone: string };
    availabilityViewInterval?: number; // In minutes, default 30
  }) {
    return this.request<{
      value: Array<{
        scheduleId: string;
        availabilityView: string; // "0" = free, "1" = tentative, "2" = busy, "3" = OOF, "4" = working elsewhere
        scheduleItems: Array<{
          isPrivate: boolean;
          status: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere';
          subject?: string;
          location?: string;
          start: { dateTime: string; timeZone: string };
          end: { dateTime: string; timeZone: string };
        }>;
        workingHours?: {
          daysOfWeek: string[];
          startTime: string;
          endTime: string;
          timeZone: { name: string };
        };
      }>;
    }>('/me/calendar/getSchedule', {
      method: 'POST',
      body: JSON.stringify({
        schedules: params.schedules,
        startTime: params.startTime,
        endTime: params.endTime,
        availabilityViewInterval: params.availabilityViewInterval || 30,
      }),
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
