import { redirect } from 'next/navigation';

// Scheduler webhooks - redirect to calendar
export default function SchedulerWebhooksPage() {
  redirect('/calendar');
}
