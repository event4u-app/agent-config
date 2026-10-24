<?php

add_action('init', 'acme_register_types');
add_filter('the_content', 'acme_filter_content', 20, 1);
add_shortcode('card', 'acme_card_shortcode');
add_action('wp_footer', function () {
    echo '';
});
do_action('acme_loaded');
$cache->get('/init');

function acme_register_types()
{
}

function acme_filter_content($content)
{
    return $content;
}

function acme_card_shortcode($atts)
{
    ob_start();
    get_template_part('parts/card');
    get_template_part('parts/card', 'wide');
    get_template_part('parts/missing');
    return ob_get_clean();
}
