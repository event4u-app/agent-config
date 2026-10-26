<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shops', function (Blueprint $table) {
            $table->id();
        });
        Schema::create('warehouses', function (Blueprint $table) {
            $table->id();
        });
    }

    public function down(): void
    {
    }
};
