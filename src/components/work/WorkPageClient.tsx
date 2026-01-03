'use client';

import { WorkView } from './WorkView';
import { QueueId, QueueResult } from '@/lib/work';

interface WorkPageClientProps {
  initialQueuesArray: [QueueId, QueueResult][];
}

export function WorkPageClient({ initialQueuesArray }: WorkPageClientProps) {
  const initialQueues = new Map<QueueId, QueueResult>(initialQueuesArray);
  return <WorkView initialQueues={initialQueues} />;
}
