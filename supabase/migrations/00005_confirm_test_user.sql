-- Confirm test user email
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'test@xrai.com';
