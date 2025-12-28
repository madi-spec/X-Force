/**
 * Social Proof API
 *
 * GET - Get social proof for a company or performance report
 * POST - Record social proof usage
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSocialProofForCompany,
  selectSocialProofForScheduling,
  recordSocialProofUsage,
  getSocialProofPerformance,
} from '@/lib/scheduler';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('company_id');
    const schedulingRequestId = searchParams.get('scheduling_request_id');
    const attemptNumber = parseInt(searchParams.get('attempt') || '1');
    const performanceReport = searchParams.get('performance') === 'true';

    // Get performance report
    if (performanceReport) {
      const report = await getSocialProofPerformance();
      return NextResponse.json({ data: report });
    }

    // Get social proof for scheduling request
    if (schedulingRequestId) {
      const selection = await selectSocialProofForScheduling(
        schedulingRequestId,
        attemptNumber
      );
      return NextResponse.json({ data: selection });
    }

    // Get social proof for company
    if (companyId) {
      const proof = await getSocialProofForCompany(companyId);
      return NextResponse.json({ data: proof });
    }

    return NextResponse.json(
      { error: 'Either company_id, scheduling_request_id, or performance=true is required' },
      { status: 400 }
    );
  } catch (err) {
    console.error('[SocialProof API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to get social proof' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scheduling_request_id, social_proof_id, attempt_number } = body;

    if (!scheduling_request_id || !social_proof_id) {
      return NextResponse.json(
        { error: 'scheduling_request_id and social_proof_id are required' },
        { status: 400 }
      );
    }

    await recordSocialProofUsage(
      scheduling_request_id,
      social_proof_id,
      attempt_number || 1
    );

    return NextResponse.json({
      message: 'Social proof usage recorded',
    });
  } catch (err) {
    console.error('[SocialProof API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to record usage' },
      { status: 500 }
    );
  }
}
