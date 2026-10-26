CREATE VIEW active_users AS
SELECT id, name, email
FROM users
WHERE deleted_at IS NULL;
