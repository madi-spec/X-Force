import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Users list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add computed initials
    const usersWithInitials = (data || []).map(user => {
      const nameParts = (user.name || '').split(' ');
      const initials = nameParts.length >= 2
        ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
        : (user.name || '').slice(0, 2).toUpperCase();
      return {
        ...user,
        initials,
      };
    });

    return NextResponse.json(usersWithInitials);
  } catch (error) {
    console.error('Users list error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
