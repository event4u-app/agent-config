---
name: wordpress
description: "Use when writing WordPress plugins, WooCommerce extensions, or following WordPress coding standards."
---

# wordpress

## When to use

WordPress plugins/themes/WooCommerce. Before: project type, WP version, PHP version, coding standards, existing patterns.

## Plugin structure

```
my-plugin/
├── my-plugin.php          # Main plugin file (header, bootstrap)
├── includes/              # PHP classes
│   ├── class-admin.php
│   └── class-frontend.php
├── assets/                # CSS, JS, images
├── templates/             # Template files
├── languages/             # Translation files
└── readme.txt             # WordPress.org readme
```

## Hooks and filters

```php
// Action — do something at a specific point
add_action('init', [$this, 'registerPostTypes'], 10, 0);
add_action('wp_enqueue_scripts', [$this, 'enqueueAssets'], 10, 0);
add_action('save_post', [$this, 'onSavePost'], 10, 3);

// Filter — modify data passing through
add_filter('the_content', [$this, 'appendDisclaimer'], 10, 1);
add_filter('woocommerce_product_get_price', [$this, 'adjustPrice'], 10, 2);
```

**Always specify priority and argument count** for clarity.

## Security

```php
// Nonce verification
if (!wp_verify_nonce($_POST['_wpnonce'] ?? '', 'my_action')) {
    wp_die('Security check failed', '', ['response' => 403]);
}

// Capability check
if (!current_user_can('manage_options')) {
    wp_die('Unauthorized');
}

// Data sanitization (always use null-coalescing for missing keys)
$title = sanitize_text_field($_POST['title'] ?? '');
$email = sanitize_email($_POST['email'] ?? '');
$html = wp_kses_post($_POST['content'] ?? '');

// Output escaping
echo esc_html($title);
echo esc_attr($value);
echo esc_url($url);
echo wp_kses_post($html);
```

## Database queries

```php
global $wpdb;

// ✅ Prepared statements
$results = $wpdb->get_results(
    $wpdb->prepare("SELECT * FROM {$wpdb->prefix}my_table WHERE id = %d", $id)
);

// ✅ Insert
$wpdb->insert($wpdb->prefix . 'my_table', [
    'name' => $name,
    'value' => $value,
], ['%s', '%s']);

// ❌ Never interpolate directly
$wpdb->query("SELECT * FROM {$wpdb->prefix}my_table WHERE id = {$id}");
```

## WooCommerce patterns

```php
// Custom product field
add_action('woocommerce_product_options_general_product_data', function () {
    woocommerce_wp_text_input([
        'id' => '_custom_field',
        'label' => __('Custom Field', 'my-plugin'),
        'type' => 'text',
    ]);
});

// Save custom field
add_action('woocommerce_process_product_meta', function ($post_id) {
    $value = sanitize_text_field($_POST['_custom_field'] ?? '');
    update_post_meta($post_id, '_custom_field', $value);
});

// Modify cart item price
add_action('woocommerce_before_calculate_totals', function ($cart) {
    foreach ($cart->get_cart() as $item) {
        $item['data']->set_price('99.99');
    }
});
```

## WordPress coding standards

- **Function naming:** `snake_case` with plugin prefix: `myplugin_do_something()`.
- **Class naming:** `My_Plugin_Admin` (WordPress style) or `MyPlugin\Admin` (namespaced).
- **Hooks:** Prefix all hooks with plugin slug: `myplugin_before_save`.
- **Text domain:** Use consistent text domain for translations: `__('Text', 'my-plugin')`.
- **Yoda conditions:** `if ( 'value' === $var )` (WordPress standard).

## Core rules

- **Always escape output** — `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses_post()`.
- **Always sanitize input** — `sanitize_text_field()`, `absint()`, `sanitize_email()`.
- **Always use prepared statements** — `$wpdb->prepare()` for all queries.
- **Always check capabilities** — `current_user_can()` before privileged actions.
- **Always verify nonces** — `wp_verify_nonce()` for form submissions.
- **Use WordPress APIs** — don't reinvent what WordPress provides.


## Gotcha: hook priority matters, use WP_Query not direct DB, don't modify core, sanitize=input / esc=output.

## Do NOT

- Do not use raw `$_GET`/`$_POST` without sanitization.
- Do not echo user data without escaping.
- Do not use direct SQL without `$wpdb->prepare()`.
- Do not modify core WordPress files.
- Do not use `extract()` — it's a security risk.
- Do not load scripts/styles globally — enqueue only where needed.
- Do not use PHP sessions — WordPress doesn't use them by default.
