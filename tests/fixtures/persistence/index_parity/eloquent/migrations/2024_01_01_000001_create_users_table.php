<?php

// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Schema expectation: table `users`
//   indexed columns: id (primary), email (unique)
//   plain columns:   name, created_at, updated_at (via timestamps())

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('name');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
