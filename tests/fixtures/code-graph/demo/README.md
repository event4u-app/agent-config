# Demo shop

Sample data for the knowledge map. Orders are placed through `app/Http/Controllers/OrderController.php`,
stock comes from the partner over REST and SOAP (`app/Services/PartnerClient.php`), and
`app/Jobs/SyncStock.php` refreshes it on the queue.
