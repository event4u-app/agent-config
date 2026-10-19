<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tax_brackets', function (Blueprint $t) {
            $t->id();
            $t->string('label');
            $t->unsignedInteger('rate_basis_points');
            $t->timestamps();
        });
        Schema::create('invoice_lines', function (Blueprint $t) {
            $t->id();
            $t->string('description');
            $t->bigInteger('net_cents');
            $t->foreignId('tax_bracket_id')->constrained();
            $t->timestamps();
        });
        Schema::create('remittance_advices', function (Blueprint $t) {
            $t->id();
            $t->string('payer_reference');
            $t->bigInteger('amount_cents');
            $t->timestamp('received_at')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('remittance_advices');
        Schema::dropIfExists('invoice_lines');
        Schema::dropIfExists('tax_brackets');
    }
};
