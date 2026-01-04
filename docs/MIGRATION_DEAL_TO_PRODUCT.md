# Deal to Product Migration

## Overview

In January 2026, X-FORCE completed migration from a deal-centric to product-centric architecture.

## Timeline

- **Phase 1:** Database schema (company_product_id columns)
- **Phase 2:** Scheduler system
- **Phase 3:** Command Center
- **Phase 4:** Activities, Tasks, Transcriptions
- **Phase 5:** UI Navigation
- **Phase 6:** Cleanup & Documentation

## Key Changes

### Data Model

- Primary entity changed from `deals` to `company_products`
- All tables now support `company_product_id` alongside `deal_id`
- New records should use `company_product_id`

### Navigation

- `/deals` redirects to `/products`
- Legacy deals accessible at `/legacy-deals`
- Products pipeline is the primary sales view

### API Changes

- All endpoints accept `company_product_id`
- `deal_id` still accepted for backwards compatibility
- New integrations should use `company_product_id`

## For Developers

### DO use company_product_id for:

- New activity creation
- New task creation
- New meeting transcriptions
- Scheduler requests
- Command center items

### DON'T use deal_id for:

- Any new development
- New integrations
- New features

### Migration Utilities

- `/api/deals/[id]/convert` - Convert legacy deal to company_products
- `deal_conversions` table - Maps legacy deals to products

## Database Schema

### company_products (Current)

```sql
- id (UUID)
- company_id (UUID)
- product_id (UUID)
- status (in_sales, in_onboarding, active, inactive)
- current_stage_id (UUID -> product_process_stages)
- mrr (NUMERIC)
- owner_user_id (UUID -> users)
```

### deals (Legacy)

```sql
- id (UUID)
- company_id (UUID)
- stage (TEXT)
- estimated_value (NUMERIC)
- [other legacy fields]
```

### deal_conversions (Migration Tracking)

```sql
- legacy_deal_id (UUID -> deals)
- company_product_id (UUID -> company_products)
- converted_at (TIMESTAMPTZ)
```

## Tables with company_product_id

The following tables have `company_product_id` columns:

1. `activities` - Activity tracking
2. `tasks` - Task management
3. `meeting_transcriptions` - Meeting recordings
4. `scheduling_requests` - Scheduler system
5. `command_center_items` - Work queue items
6. `ai_email_drafts` - AI-generated drafts
7. `ai_signals` - AI-detected signals
8. `communications` - Communication hub

## Troubleshooting

### "Deal not found" errors

1. Check if the deal was converted
2. Use `deal_conversions` to find the `company_product_id`
3. Redirect to company or product page

### Missing product data

1. Verify `company_product_id` is set
2. Check `company_products` table for the record
3. May need to run data migration script

### Looking up company_product for a company

```typescript
const { data: cp } = await supabase
  .from('company_products')
  .select('id')
  .eq('company_id', companyId)
  .in('status', ['in_sales', 'in_onboarding', 'active'])
  .order('updated_at', { ascending: false })
  .limit(1)
  .single();
```

## Migration Scripts

- `scripts/migrate-deal-to-product-ids.ts` - Backfill company_product_id
- `scripts/migrate-deals-to-company-products.ts` - Convert deals to products

## Commit History

- Phase 1: `00a977e` - Database schema
- Phase 2: `c7e6d43` - Scheduler system
- Phase 3: `7e26402` - Command Center
- Phase 4: `beae967` - Activities, Tasks, Transcriptions
- Phase 5: `4fbae65` - UI Navigation
- Phase 6: (this commit) - Final cleanup
