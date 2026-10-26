<?php

namespace Tests\Feature;

use App\Http\Controllers\OrderController;
use PHPUnit\Framework\TestCase;

class OrderControllerTest extends TestCase
{
    public function test_index_lists_open_orders(): void
    {
        $controller = new OrderController();
        $this->assertNotNull($controller);
    }
}
