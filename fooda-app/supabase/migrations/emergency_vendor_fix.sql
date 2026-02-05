-- Emergency Vendor Profile Creation
-- Run this if vendor login is failing with "No Vendor Profile Found"

-- Step 1: Show all vendor auth users and their current status
SELECT 
    'Current Status' as info,
    au.id as auth_user_id,
    au.email,
    au.raw_user_meta_data->>'role' as auth_role,
    u.id as user_record_id,
    v.id as vendor_profile_id,
    CASE 
        WHEN u.id IS NULL THEN '❌ No user record'
        WHEN v.id IS NULL THEN '❌ No vendor profile'
        ELSE '✅ Complete'
    END as status
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
LEFT JOIN vendors v ON v.owner_id = au.id
WHERE au.raw_user_meta_data->>'role' = 'vendor'
ORDER BY au.created_at DESC;

-- Step 2: Create user records for ALL vendor auth users (if missing)
DO $$
DECLARE
    vendor_record RECORD;
BEGIN
    FOR vendor_record IN 
        SELECT 
            au.id,
            au.email,
            COALESCE(
                au.raw_user_meta_data->>'business_name',
                au.raw_user_meta_data->>'full_name',
                split_part(au.email, '@', 1)
            ) as full_name
        FROM auth.users au
        WHERE au.raw_user_meta_data->>'role' = 'vendor'
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = au.id)
    LOOP
        BEGIN
            INSERT INTO users (id, email, role, full_name, is_active, created_at)
            VALUES (
                vendor_record.id,
                vendor_record.email,
                'vendor',
                vendor_record.full_name,
                true,
                NOW()
            );
            RAISE NOTICE 'Created user record for: %', vendor_record.email;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to create user for %: %', vendor_record.email, SQLERRM;
        END;
    END LOOP;
END $$;

-- Step 3: Create vendor profiles for ALL users with vendor role (if missing)
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT 
            u.id,
            u.email,
            u.full_name
        FROM users u
        WHERE u.role = 'vendor'
        AND NOT EXISTS (SELECT 1 FROM vendors v WHERE v.owner_id = u.id)
    LOOP
        BEGIN
            INSERT INTO vendors (owner_id, name, email, is_active, created_at)
            VALUES (
                user_record.id,
                user_record.full_name,
                user_record.email,
                true,
                NOW()
            );
            RAISE NOTICE 'Created vendor profile for: %', user_record.email;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to create vendor for %: %', user_record.email, SQLERRM;
        END;
    END LOOP;
END $$;

-- Step 4: Verify all vendors now have complete records
SELECT 
    'After Fix' as info,
    au.id as auth_user_id,
    au.email,
    u.id as user_record_id,
    v.id as vendor_profile_id,
    v.name as vendor_name,
    u.is_active as user_active,
    v.is_active as vendor_active,
    CASE 
        WHEN u.id IS NULL THEN '❌ Still missing user record'
        WHEN v.id IS NULL THEN '❌ Still missing vendor profile'
        ELSE '✅ Complete - Ready to login'
    END as status
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
LEFT JOIN vendors v ON v.owner_id = au.id
WHERE au.raw_user_meta_data->>'role' = 'vendor'
ORDER BY au.created_at DESC;

-- Step 5: Check RLS policies on vendors table
SELECT 
    'RLS Policies' as info,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'vendors'
ORDER BY cmd, policyname;
