-- Link test auth user to users table
UPDATE users
SET auth_id = 'b14d8841-5012-41ee-9bc4-ccf874e9d163'
WHERE email = 'test@xrai.com';
