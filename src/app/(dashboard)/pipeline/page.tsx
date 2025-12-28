import { redirect } from 'next/navigation';

// Pipeline is now part of the unified Deals page
export default function PipelinePage() {
  redirect('/deals');
}
