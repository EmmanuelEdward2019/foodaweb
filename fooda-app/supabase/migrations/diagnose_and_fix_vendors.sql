-- Check and Fix Vendor Accounts
-- This script diagnoses and fixes vendor login issues

-- Step 1: Check if user exists in auth.users
SELECT 
    'Auth Users' as table_name,
    id,
    email,
    raw_user_meta_data->>'role' as role,
    created_at
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'vendor'
ORDER BY created_at DESC;

-- Step 2: Check if user exists in public.users table
SELECT 
    'Public Users' as table_name,
    id,
    email,
    role,
    full_name,
    is_active,
    created_at
FROM users
WHERE role = 'vendor'
ORDER BY created_at DESC;

-- Step 3: Check if vendor profile exists
SELECT 
    'Vendors' as table_name,
    v.id,
    v.owner_id,
    v.name,
    v.email,
    v.is_active,
    v.created_at,
    u.email as user_email
FROM vendors v
LEFT JOIN users u ON u.id = v.owner_id
ORDER BY v.created_at DESC;

-- Step 4: Find auth users without user records
SELECT 
    'Missing User Records' as issue,
    au.id,
    au.email,
    au.raw_user_meta_data->>'role' as role
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'vendor'
AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = au.id
);

-- Step 5: Find users without vendor profiles
SELECT 
    'Missing Vendor Profiles' as issue,
    u.id,
    u.email,
    u.full_name,
    u.role
FROM users u
WHERE u.role = 'vendor'
AND NOT EXISTS (
    SELECT 1 FROM vendors v WHERE v.owner_id = u.id
);

-- ============================================
-- FIX SECTION - Run these if issues found
-- ============================================

-- Fix 1: Create missing user records for auth users
INSERT INTO users (id, email, role, full_name, is_active)
SELECT 
    au.id,
    au.email,
    'vendor' as role,
    COALESCE(
        au.raw_user_meta_data->>'business_name',
        au.raw_user_meta_data->>'full_name',
        split_part(au.email, '@', 1)
    ) as full_name,
    true as is_active
FROM auth.users au
WHERE au.raw_user_meta_data->>'role' = 'vendor'
AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Fix 2: Create missing vendor profiles for users
INSERT INTO vendors (owner_id, name, email, is_active)
SELECT 
    u.id as owner_id,
    u.full_name as name,
    u.email,
    true as is_active
FROM users u
WHERE u.role = 'vendor'
AND NOT EXISTS (
    SELECT 1 FROM vendors v WHERE v.owner_id = u.id
)
ON CONFLICT DO NOTHING;

-- Step 6: Verify fixes
SELECT 
    'Verification' as status,
    (SELECT COUNT(*) FROM auth.users WHERE raw_user_meta_data->>'role' = 'vendor') as auth_vendors,
    (SELECT COUNT(*) FROM users WHERE role = 'vendor') as user_vendors,
    (SELECT COUNT(*) FROM vendors) as vendor_profiles;

-- Step 7: Show all vendor accounts with their status
SELECT 
    au.email,
    au.id as auth_id,
    u.id as user_id,
    v.id as vendor_id,
    u.is_active as user_active,
    v.is_active as vendor_active,
    CASE 
        WHEN u.id IS NULL THEN '❌ Missing user record'
        WHEN v.id IS NULL THEN '❌ Missing vendor profile'
        WHEN u.is_active = false THEN '⚠️ User deactivated'
        WHEN v.is_active = false THEN '⚠️ Vendor deactivated'
        ELSE '✅ All good'
    END as status
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
LEFT JOIN vendors v ON v.owner_id = au.id
WHERE au.raw_user_meta_data->>'role' = 'vendor'
ORDER BY au.created_at DESC;
