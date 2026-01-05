-- Migration: Switch company_products FK from product_sales_stages to product_process_stages
-- This completes the process consolidation by using the unified stages table

-- Step 1: Drop the existing FK constraint to product_sales_stages
-- The constraint name may vary, so we use a dynamic approach
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find the FK constraint name
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'company_products'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'product_sales_stages'
        AND ccu.column_name = 'id';

    -- Drop the constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE company_products DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No FK constraint found to product_sales_stages';
    END IF;
END $$;

-- Step 2: Add new FK constraint to product_process_stages
ALTER TABLE company_products
ADD CONSTRAINT company_products_current_stage_id_fkey
FOREIGN KEY (current_stage_id)
REFERENCES product_process_stages(id)
ON DELETE SET NULL;

-- Step 3: Create index for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_company_products_current_stage_id
ON company_products(current_stage_id);

-- Verify the migration
DO $$
DECLARE
    fk_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'company_products'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'product_process_stages'
    ) INTO fk_exists;

    IF fk_exists THEN
        RAISE NOTICE 'SUCCESS: FK now points to product_process_stages';
    ELSE
        RAISE EXCEPTION 'FAILED: FK was not created properly';
    END IF;
END $$;
