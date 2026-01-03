import { createClient } from '@/lib/supabase/server';
import { WorkPageClient } from '@/components/work/WorkPageClient';
import {
  QueueId,
  QueueResult,
  QUEUE_CONFIGS,
  fetchQueueItems,
} from '@/lib/work';

export default async function WorkPage() {
  const supabase = await createClient();

  // Pre-fetch queue data for initial render
  // The client component will refresh based on lens selection
  const initialQueues = new Map<QueueId, QueueResult>();

  // Fetch initial queues for all lenses (the client will filter by current lens)
  // This provides a faster initial load experience
  await Promise.all(
    QUEUE_CONFIGS.map(async (queue) => {
      try {
        const result = await fetchQueueItems(supabase, queue.id, { limit: 10 });
        initialQueues.set(queue.id, result);
      } catch (error) {
        console.error(`Error fetching queue ${queue.id}:`, error);
        // Create empty result for failed queues
        initialQueues.set(queue.id, {
          queue,
          items: [],
          stats: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
          hasMore: false,
        });
      }
    })
  );

  // Convert Map to array for serialization to client
  const queuesArray = Array.from(initialQueues.entries());

  return <WorkPageClient initialQueuesArray={queuesArray} />;
}
