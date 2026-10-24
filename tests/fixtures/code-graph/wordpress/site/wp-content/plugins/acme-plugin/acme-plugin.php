<?php
/**
 * Plugin Name: Acme Plugin
 */

namespace Acme\Plugin;

class Plugin
{
    public function __construct()
    {
        add_action('admin_menu', [$this, 'boot']);
        add_action('save_post', array($this, 'save'));
        add_action('rest_api_init', [Routes::class, 'register']);
        add_action('plugins_loaded', 'acme_shared_helper');
        add_action('shutdown', 'acme_dup');
    }

    public function boot()
    {
    }

    public function save()
    {
    }
}
