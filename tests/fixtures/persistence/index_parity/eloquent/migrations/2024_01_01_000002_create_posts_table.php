<?php

// Fixture for spike S0.2 (index parity) — road-to-scale-and-history-discipline.
// Schema expectation: table `posts`
//   indexed columns: id (primary), user_id (foreignId->constrained), status (->index())
//   plain columns:   title, body, view_count, published_at, created_at, updated_at

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status')->index();
            $table->string('title');
            $table->text('body');
            $table->integer('view_count')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
