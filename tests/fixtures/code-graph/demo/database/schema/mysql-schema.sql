-- MySQL dump 10.13  Distrib 8.0.36, for Linux (x86_64)
--
-- Schema only: `php artisan schema:dump` of the session store.

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`)
);
