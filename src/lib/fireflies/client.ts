/**
 * Fireflies.ai API Client
 * GraphQL wrapper for Fireflies meeting transcription API
 */

const FIREFLIES_API_URL = 'https://api.fireflies.ai/graphql';

export interface FirefliesUser {
  user_id: string;
  email: string;
  name: string;
  minutes_consumed: number;
  is_admin: boolean;
}

export interface FirefliesSentence {
  speaker_name: string;
  speaker_id: string;
  text: string;
  raw_text: string;
  start_time: number;
  end_time: number;
}

export interface FirefliesTranscript {
  id: string;
  title: string;
  date: number; // Unix timestamp in milliseconds
  duration: number; // seconds
  organizer_email: string;
  participants: string[];
  transcript_url: string;
  audio_url: string;
  video_url: string | null;

  // Summary from Fireflies (may be null if not processed)
  summary: {
    overview?: string;
    shorthand_bullet?: string[];
    action_items?: string[];
    outline?: string[];
    keywords?: string[];
  } | null;

  // Full transcript with speaker diarization (may be empty)
  sentences: FirefliesSentence[];
}

export interface FirefliesTranscriptListItem {
  id: string;
  title: string;
  date: number; // Unix timestamp in milliseconds
  duration: number;
  organizer_email: string;
  participants: string[];
}

export class FirefliesClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Execute a GraphQL query against Fireflies API
   */
  private async query<T>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    const response = await fetch(FIREFLIES_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Fireflies API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      console.error('[Fireflies API] GraphQL errors:', JSON.stringify(result.errors, null, 2));
      const errorMessages = result.errors.map((e: { message?: string }) => e.message).join(', ');
      throw new Error(errorMessages || 'Unknown Fireflies API error');
    }

    return result.data;
  }

  /**
   * Test connection by fetching user info
   */
  async testConnection(): Promise<{ success: boolean; user?: FirefliesUser; error?: string }> {
    try {
      const user = await this.getUser();
      return { success: true, user };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current user info
   */
  async getUser(): Promise<FirefliesUser> {
    const query = `
      query {
        user {
          user_id
          email
          name
          minutes_consumed
          is_admin
        }
      }
    `;

    const data = await this.query<{ user: FirefliesUser }>(query);
    return data.user;
  }

  /**
   * Get list of transcripts (without full content)
   *
   * By default, Fireflies API only returns meetings where you're the organizer.
   * Setting mine=false returns ALL meetings in the workspace where you have access,
   * including meetings where you were a participant but not the organizer.
   */
  async getTranscripts(options: {
    limit?: number;
    skip?: number;
    includeParticipantMeetings?: boolean;
  } = {}): Promise<FirefliesTranscriptListItem[]> {
    const { limit = 50, skip = 0, includeParticipantMeetings = true } = options;

    // When includeParticipantMeetings is true, we set mine=false to get all accessible meetings
    // This includes meetings where the user was a participant but not the organizer
    const query = `
      query Transcripts($limit: Int, $skip: Int, $mine: Boolean) {
        transcripts(limit: $limit, skip: $skip, mine: $mine) {
          id
          title
          date
          duration
          organizer_email
          participants
        }
      }
    `;

    const variables = {
      limit,
      skip,
      mine: includeParticipantMeetings ? false : true,
    };

    console.log('[Fireflies API] Fetching transcripts with mine=' + variables.mine);

    const data = await this.query<{ transcripts: FirefliesTranscriptListItem[] }>(
      query,
      variables
    );

    return data.transcripts || [];
  }

  /**
   * Get recent transcripts since a specific date
   */
  async getRecentTranscripts(options: {
    limit?: number;
    fromDate?: Date;
  } = {}): Promise<FirefliesTranscriptListItem[]> {
    const { limit = 100, fromDate } = options;

    // Fireflies doesn't have a date filter in the API, so we fetch and filter client-side
    const transcripts = await this.getTranscripts({ limit });

    if (fromDate) {
      // Fireflies returns dates in milliseconds
      const fromTimestamp = fromDate.getTime();
      return transcripts.filter(t => t.date >= fromTimestamp);
    }

    return transcripts;
  }

  /**
   * Get single transcript with full content
   */
  async getTranscript(transcriptId: string): Promise<FirefliesTranscript> {
    // Note: Fireflies API uses 'transcript_id' as the argument name
    const query = `
      query GetTranscript($transcriptId: String!) {
        transcript(id: $transcriptId) {
          id
          title
          date
          duration
          organizer_email
          participants
          transcript_url
          audio_url
          video_url

          summary {
            overview
            shorthand_bullet
            action_items
            outline
            keywords
          }

          sentences {
            speaker_name
            speaker_id
            text
            raw_text
            start_time
            end_time
          }
        }
      }
    `;

    console.log('[Fireflies API] Fetching transcript:', transcriptId);
    const data = await this.query<{ transcript: FirefliesTranscript }>(
      query,
      { transcriptId }
    );

    if (!data.transcript) {
      throw new Error(`Transcript not found: ${transcriptId}`);
    }

    return data.transcript;
  }

  /**
   * Build full transcript text from sentences
   */
  static buildTranscriptText(sentences: FirefliesSentence[]): string {
    return sentences
      .map(s => `${s.speaker_name}: ${s.text}`)
      .join('\n');
  }

  /**
   * Parse participant strings to extract names and emails
   * Fireflies formats participants as "Name <email>" or just "email" or just "Name"
   */
  static parseParticipants(participants: string[]): Array<{ name: string; email?: string }> {
    return participants.map(p => {
      // Match "Name <email@example.com>" format
      const emailMatch = p.match(/<(.+@.+)>/);

      if (emailMatch) {
        const email = emailMatch[1];
        const name = p.replace(/<.+>/, '').trim();
        return { name: name || email, email };
      }

      // Check if it's just an email
      if (p.includes('@')) {
        return { name: p, email: p };
      }

      // Just a name
      return { name: p };
    });
  }

  /**
   * Format duration in seconds to human-readable string
   */
  static formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }

    return `${minutes}m`;
  }
}
