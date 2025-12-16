import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { callAIJson } from '@/lib/ai/core/aiClient';

interface EmailSuggestion {
  subject: string;
  body: string;
  tone: string;
  callToAction: string;
}

export async function POST(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, description, type, priority, deal_id, company_id, deal:deals(id, name, stage, estimated_value, company:companies(id, name, segment, industry)), company:companies(id, name, segment, industry)')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const deal = task.deal as unknown as Record<string, unknown> | null;
    const dealCompany = deal?.company as unknown as Record<string, unknown> | null;
    const taskCompany = task.company as unknown as Record<string, unknown> | null;
    const companyId = task.company_id || dealCompany?.id;
    const company = taskCompany || dealCompany;
    
    let recentActivities: Array<Record<string, unknown>> = [];
    if (companyId) {
      const { data: activities } = await supabase
        .from('activities')
        .select('type, subject, body, occurred_at')
        .eq('company_id', companyId)
        .order('occurred_at', { ascending: false })
        .limit(5);
      recentActivities = activities || [];
    }

    let contacts: Array<Record<string, unknown>> = [];
    if (companyId) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('name, email, title, role')
        .eq('company_id', companyId)
        .limit(5);
      contacts = contactData || [];
    }

    const companyName = company?.name || 'Unknown Company';
    const companySegment = company?.segment || 'unknown segment';
    const companyIndustry = company?.industry || 'pest/lawn';
    const dealName = deal?.name || '';
    const dealStage = deal?.stage || '';
    const dealValue = (deal?.estimated_value as number) || 0;

    const contextParts = [
      'Task: ' + task.title,
      task.description ? 'Task Description: ' + task.description : '',
      company ? 'Company: ' + companyName + ' (' + companySegment + ', ' + companyIndustry + ' industry)' : '',
      deal ? 'Deal: ' + dealName + ' - Stage: ' + dealStage + ' - Value: $' + dealValue.toLocaleString() : '',
      contacts.length > 0 ? 'Key Contacts:\n' + contacts.map(c => '- ' + c.name + ' (' + (c.title || 'No title') + ') - ' + (c.email || 'No email')).join('\n') : '',
      recentActivities.length > 0 ? 'Recent Activity:\n' + recentActivities.map(a => '- ' + a.type + ': ' + (a.subject || 'No subject')).join('\n') : '',
    ].filter(Boolean);

    const prompt = 'Based on this sales task context, generate a professional email that the sales rep should send.\n\nContext:\n' + contextParts.join('\n\n') + '\n\nTask Priority: ' + task.priority + '\n\nGenerate a professional sales email that:\n1. Has a compelling subject line\n2. Is personalized to the company/contact if available\n3. Has a clear call-to-action appropriate for the task and deal stage\n4. Is concise but warm in tone\n5. References any relevant recent activity if appropriate\n\nRespond with JSON:\n{\n  "subject": "Email subject line",\n  "body": "Full email body with greeting and signature placeholder [Your Name]",\n  "tone": "Brief description of the tone used",\n  "callToAction": "What action you are asking them to take"\n}';

    const response = await callAIJson<EmailSuggestion>({
      prompt,
      maxTokens: 1500,
    });

    return NextResponse.json({
      suggestion: response.data,
      context: {
        company: companyName,
        deal: dealName,
        contacts: contacts.map(c => ({ name: c.name, email: c.email })),
      },
    });
  } catch (error) {
    console.error('Error generating email suggestion:', error);
    return NextResponse.json({ error: 'Failed to generate email suggestion' }, { status: 500 });
  }
}
