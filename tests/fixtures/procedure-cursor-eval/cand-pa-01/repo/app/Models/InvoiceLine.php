<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceLine extends Model
{
    protected $fillable = ['description', 'net_cents', 'tax_bracket_id'];

    public function taxBracket(): BelongsTo
    {
        return $this->belongsTo(TaxBracket::class);
    }
}
