<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('agent_id');
            $table->foreign('agent_id')->references('id')->on('users')->nullOnDelete();
            $table->integer('coupon_id');
            $table->foreign('coupon_id')->references('id')->on('coupons');
            $table->unsignedBigInteger('shop_id');
            $table->unsignedBigInteger('warehouse_id');
            $table->string('status');
            $table->string('note')->nullable();
            $table->index('status');
            $table->index(['status', 'created_at']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
    }
};
