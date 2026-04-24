-- Step 1: Check what vendor accounts exist
-- Run this first to see what we have

SELECT 
    u.id as user_id,
    u.email,
    u.role,
    u.full_name,
    u.is_active as user_active,
    v.id as vendor_id,
    v.name as vendor_name,
    v.is_active as vendor_active
FROM users u
LEFT JOIN vendors v ON v.owner_id = u.id
WHERE u.role = 'vendor'
ORDER BY u.created_at DESC;

-- Step 2: If you see a user without a vendor_id, create the vendor profile
-- Replace 'USER_ID_HERE' with the actual user ID from Step 1
-- Replace 'USER_EMAIL_HERE' with the actual email
-- Replace 'BUSINESS_NAME_HERE' with the business name

/*
INSERT INTO vendors (owner_id, name, email, is_active)
VALUES (
  'USER_ID_HERE',
  'BUSINESS_NAME_HERE',
  'USER_EMAIL_HERE',
  true
);
*/

-- Step 3: Verify the vendor was created
/*
SELECT 
    v.*,
    u.email as owner_email
FROM vendors v
JOIN users u ON v.owner_id = u.id
WHERE v.owner_id = 'USER_ID_HERE';
*/
