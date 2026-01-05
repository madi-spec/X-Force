# PHASE 2: API Routes

## Objective
Create the API routes needed to fetch process data, move stages, and manage pipeline items.

## Pre-Phase Checklist
- [ ] Phase 1 complete (database schema and types exist)
- [ ] Verify `product_pipeline_items` view works via Postgres MCP
- [ ] Review existing API patterns in `src/app/api/`

## Tasks

### 2.1 Create Process Pipeline API
Create file: `src/app/api/products/process/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProcessType, ProcessStats, PipelineItem, StageDefinition, ProcessViewResponse } from '@/types/products';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  const { searchParams } = new URL(request.url);
  const process = (searchParams.get('process') || 'sales') as ProcessType;
  const products = searchParams.get('products')?.split(',').filter(Boolean) || [];
  const users = searchParams.get('users')?.split(',').filter(Boolean) || [];
  const health = searchParams.get('health') || 'all';
  const search = searchParams.get('search') || '';

  try {
    // Map process type to status filter
    const statusMap: Record<ProcessType, string[]> = {
      sales: ['in_sales'],
      onboarding: ['in_onboarding'],
      customer_service: ['active'], // Service tickets for active customers
      engagement: ['active'],
    };
    
    const statuses = statusMap[process] || ['in_sales'];

    // Build query
    let query = supabase
      .from('product_pipeline_items')
      .select('*')
      .in('status', statuses);

    // Apply filters
    if (products.length > 0) {
      query = query.in('product_id', products);
    }

    if (users.length > 0) {
      query = query.in('owner_id', users);
    }

    if (health && health !== 'all') {
      query = query.eq('health_status', health);
    }

    if (search) {
      query = query.ilike('company_name', `%${search}%`);
    }

    // Execute query
    const { data: items, error } = await query.order('days_in_stage', { ascending: false });

    if (error) {
      console.error('Process pipeline query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate stats
    const stats: ProcessStats = {
      total: items?.length || 0,
      needsAttention: items?.filter(i => i.health_status === 'attention').length || 0,
      stalled: items?.filter(i => i.health_status === 'stalled').length || 0,
      healthy: items?.filter(i => i.health_status === 'healthy').length || 0,
      totalMrr: items?.reduce((sum, i) => sum + (i.mrr || 0), 0) || 0,
      productCount: new Set(items?.map(i => i.product_id)).size,
    };

    // Get stages for this process (use sales stages for now)
    const { data: stages } = await supabase
      .from('product_sales_stages')
      .select('id, name, order_index')
      .order('order_index');

    const response: ProcessViewResponse = {
      items: items || [],
      stats,
      stages: stages || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Process pipeline error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch process data' },
      { status: 500 }
    );
  }
}
```

### 2.2 Create Process Stats API
Create file: `src/app/api/products/process/stats/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProcessType } from '@/types/products';

interface ProcessStatsResponse {
  process: ProcessType;
  total: number;
  needsAttention: number;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    // Get counts for each process type
    const processes: ProcessType[] = ['sales', 'onboarding', 'customer_service', 'engagement'];
    
    const statusMap: Record<ProcessType, string[]> = {
      sales: ['in_sales'],
      onboarding: ['in_onboarding'],
      customer_service: ['active'],
      engagement: ['active'],
    };

    const results: ProcessStatsResponse[] = [];

    for (const process of processes) {
      const statuses = statusMap[process];
      
      const { data, error } = await supabase
        .from('product_pipeline_items')
        .select('health_status')
        .in('status', statuses);

      if (error) {
        console.error(`Stats error for ${process}:`, error);
        continue;
      }

      results.push({
        process,
        total: data?.length || 0,
        needsAttention: data?.filter(i => i.health_status !== 'healthy').length || 0,
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Process stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch process stats' },
      { status: 500 }
    );
  }
}
```

### 2.3 Create Stage Move API
Create file: `src/app/api/products/process/move-stage/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface MoveStageBody {
  item_id: string;
  to_stage_id: string;
  note: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const body: MoveStageBody = await request.json();
    const { item_id, to_stage_id, note } = body;

    if (!item_id || !to_stage_id || !note || note.trim().length < 10) {
      return NextResponse.json(
        { error: 'item_id, to_stage_id, and note (min 10 chars) are required' },
        { status: 400 }
      );
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current item state
    const { data: currentItem, error: fetchError } = await supabase
      .from('company_products')
      .select('id, current_stage_id, company_id')
      .eq('id', item_id)
      .single();

    if (fetchError || !currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const from_stage_id = currentItem.current_stage_id;

    // Update the stage
    const { error: updateError } = await supabase
      .from('company_products')
      .update({
        current_stage_id: to_stage_id,
        last_stage_moved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id);

    if (updateError) {
      console.error('Stage update error:', updateError);
      return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 });
    }

    // Log activity
    const { error: activityError } = await supabase
      .from('activities')
      .insert({
        company_id: currentItem.company_id,
        user_id: user.id,
        type: 'stage_change',
        description: note,
        metadata: {
          company_product_id: item_id,
          from_stage_id,
          to_stage_id,
        },
      });

    if (activityError) {
      console.error('Activity log error:', activityError);
      // Don't fail the request, just log it
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Move stage error:', error);
    return NextResponse.json(
      { error: 'Failed to move stage' },
      { status: 500 }
    );
  }
}
```

### 2.4 Create Products List API (for filter dropdown)
Create file: `src/app/api/products/list/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, color, icon')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Products list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(products || []);
  } catch (error) {
    console.error('Products list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
```

### 2.5 Create Users List API (for filter dropdown)
Create file: `src/app/api/products/users/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, name, initials, role')
      .order('name');

    if (error) {
      console.error('Users list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(users || []);
  } catch (error) {
    console.error('Users list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
```

## Testing Criteria

### Test 1: API Response Validation
Use curl or fetch to test each endpoint:

```bash
# Test process pipeline
curl "http://localhost:3000/api/products/process?process=sales" | jq

# Test with filters
curl "http://localhost:3000/api/products/process?process=sales&health=attention" | jq

# Test stats
curl "http://localhost:3000/api/products/process/stats" | jq

# Test products list
curl "http://localhost:3000/api/products/list" | jq

# Test users list
curl "http://localhost:3000/api/products/users" | jq
```

### Test 2: Database Query Verification
Use Postgres MCP to verify the queries work correctly:

```sql
-- Verify the view returns expected columns
SELECT id, company_name, product_name, health_status, days_in_stage 
FROM product_pipeline_items 
WHERE status = 'in_sales' 
LIMIT 5;

-- Verify health calculation
SELECT health_status, health_reason, days_in_stage 
FROM product_pipeline_items 
WHERE health_status != 'healthy'
LIMIT 5;
```

### Test 3: Error Handling
Test error cases:
```bash
# Invalid process type should still work (defaults to sales)
curl "http://localhost:3000/api/products/process?process=invalid" | jq

# Move stage without note should fail
curl -X POST "http://localhost:3000/api/products/process/move-stage" \
  -H "Content-Type: application/json" \
  -d '{"item_id": "test", "to_stage_id": "test", "note": ""}' | jq
```

## Debugging Steps

### If API returns 500:
1. Check server logs for detailed error
2. Verify Supabase client is created correctly
3. Test the SQL query directly via Postgres MCP
4. Check for missing columns in the view

### If API returns empty results:
1. Verify data exists in `company_products` table
2. Check status values match ('in_sales', 'in_onboarding', 'active')
3. Verify the view is correctly created
4. Check filter values are being applied correctly

### If TypeScript errors:
1. Verify all imports are correct
2. Check that types match the actual data structure
3. Run `npx tsc --noEmit` for detailed errors

## Completion Checklist
- [ ] `/api/products/process` returns items and stats
- [ ] `/api/products/process/stats` returns counts for all processes
- [ ] `/api/products/process/move-stage` updates stage and logs activity
- [ ] `/api/products/list` returns products
- [ ] `/api/products/users` returns users
- [ ] All error cases handled gracefully
- [ ] No TypeScript errors

## Git Commit
```bash
git add -A
git commit -m "feat(products): add API routes for process views

- Add GET /api/products/process for pipeline items with filters
- Add GET /api/products/process/stats for process tab counts
- Add POST /api/products/process/move-stage for stage transitions
- Add GET /api/products/list for product filter dropdown
- Add GET /api/products/users for user filter dropdown"
```

## Next Phase
Say "PHASE 2 COMPLETE - PHASE 3 STARTING" and proceed to Phase 3.
