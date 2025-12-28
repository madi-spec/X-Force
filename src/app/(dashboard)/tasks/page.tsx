import { redirect } from 'next/navigation';

// Tasks are now accessed via the Tasks toggle in the Inbox
export default function TasksPage() {
  redirect('/inbox');
}
