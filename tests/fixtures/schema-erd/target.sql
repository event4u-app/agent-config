-- schema-erd fixture: the "target" state. Same normalisation class as current.sql.
-- Deltas against current.sql, one per change class:
--   users.name          varchar(191) -> text          (modified: type)
--   users.created_at    NULL -> NOT NULL             (modified: null)
--   users.locale        new                           (added)
--   orders.note         removed                       (removed)
--   orders FK on_delete restrict -> cascade           (modified: fk)
--   legacy_audit        removed                       (removed table)
--   invoices            new                           (added table)
--   users column order  status before name            (ordinal only -> unchanged)
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `status` enum('active','pending','banned') NOT NULL DEFAULT 'pending',
  `name` text NOT NULL,
  `locale` varchar(8) NOT NULL DEFAULT 'de',
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `total_cents` bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `orders_user_id_index` (`user_id`),
  CONSTRAINT `orders_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `invoices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint unsigned NOT NULL,
  `issued_at` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `invoices_order_id_index` (`order_id`),
  CONSTRAINT `invoices_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE VIEW `active_users` AS SELECT * FROM `users` WHERE `status` = 'active';
