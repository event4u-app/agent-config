<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected static function booted(): void
    {
        static::deleting(function (OrderItem $item) {
            $item->releaseStock();
        });
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
