-- Fix for existing vendor accounts that are missing user records
-- This creates user records for any authenticated users that don't have them

-- Step 1: Check which auth users don't have user records
SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data->>'role' as role,
    au.raw_user_meta_data->>'business_name' as business_name,
    u.id as user_record_exists
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE u.id IS NULL
AND au.raw_user_meta_data->>'role' = 'vendor';

-- Step 2: Create missing user records
-- This will create user records for all authenticated vendors who don't have one
INSERT INTO users (id, email, role, full_name, is_active)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'role', 'vendor') as role,
    COALESCE(
        au.raw_user_meta_data->>'business_name',
        au.raw_user_meta_data->>'full_name',
        split_part(au.email, '@', 1)
    ) as full_name,
    true as is_active
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE u.id IS NULL
AND au.raw_user_meta_data->>'role' = 'vendor'
ON CONFLICT (id) DO NOTHING;

-- Step 3: Create missing vendor profiles
-- This will create vendor profiles for all users who don't have one
INSERT INTO vendors (owner_id, name, email, is_active)
SELECT 
    u.id as owner_id,
    u.full_name as name,
    u.email,
    true as is_active
FROM users u
LEFT JOIN vendors v ON v.owner_id = u.id
WHERE v.id IS NULL
AND u.role = 'vendor'
ON CONFLICT DO NOTHING;

-- Step 4: Verify everything is fixed
SELECT 
    au.email,
    u.id as user_id,
    u.role,
    v.id as vendor_id,
    v.name as vendor_name,
    v.is_active as vendor_active
FROM auth.users au
JOIN users u ON u.id = au.id
LEFT JOIN vendors v ON v.owner_id = u.id
WHERE u.role = 'vendor'
ORDER BY au.created_at DESC;
