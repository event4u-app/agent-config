CREATE VIEW active_users AS
SELECT id, name, email_address
FROM users
WHERE deleted_at IS NULL;
