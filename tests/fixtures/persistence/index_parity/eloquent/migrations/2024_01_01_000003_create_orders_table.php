<?php

// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Schema expectation: table `orders`
//   indexed columns: id (primary), user_id (foreignId->constrained),
//                    reference (unique), shipped_at ($table->index('shipped_at'))
//   plain columns:   total, channel, created_at, updated_at

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->string('reference')->unique();
            $table->decimal('total', 10, 2);
            $table->string('channel');
            $table->timestamp('shipped_at')->nullable();
            $table->timestamps();

            $table->index('shipped_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
