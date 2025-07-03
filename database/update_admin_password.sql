-- Update admin password to 'admin123'
-- Run this if you already have the database created

USE inventory_management;

-- Update the admin user password to the correct bcrypt hash for 'admin123'
UPDATE users 
SET password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO.G'
WHERE username = 'admin';

-- Verify the update
SELECT username, email, role FROM users WHERE username = 'admin'; 