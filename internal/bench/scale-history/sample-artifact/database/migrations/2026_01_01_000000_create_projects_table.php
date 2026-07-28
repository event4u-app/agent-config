<?php
// Dry-smoke sample artifact — a deliberately imperfect "agent output" so the
// scorer pipeline runs end-to-end without any paid run.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained();
            $table->foreignId('owner_id'); // no constrained() — unindexed FK (seeded F2)
            $table->string('project_key');
            $table->string('name');
            $table->string('status');
            $table->timestamps();
        });
    }
};
