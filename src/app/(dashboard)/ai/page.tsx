import { redirect } from 'next/navigation';

export const metadata = {
  title: 'AI Command Center | X-FORCE',
  description: 'Redirecting to Command Center',
};

export default async function AIPage() {
  // Redirect to new Command Center
  redirect('/command-center');
}
