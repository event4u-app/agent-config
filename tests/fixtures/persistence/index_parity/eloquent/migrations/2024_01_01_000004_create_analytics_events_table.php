<?php

// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Schema expectation: table `analytics_events`
//   indexed columns: id (primary), event_type (->index()),
//                    occurred_at (leftmost of composite $table->index([...]))
//   plain columns:   session_id (deliberately unindexed — waiver target),
//                    payload, created_at, updated_at
// Composite-index note: only the LEFTMOST column of a composite index counts
// as indexed for single-column WHERE resolution (leftmost-prefix rule).

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_type')->index();
            $table->string('session_id');
            $table->json('payload');
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['occurred_at', 'session_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_events');
    }
};
