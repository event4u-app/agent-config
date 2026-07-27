<?php
// FIXTURE: true-positive N+1 — nested lazy relations: products per category, reviews per product.

namespace App\Services;

use App\Models\Category;

class CatalogStatsService
{
    public function reviewTotals(): array
    {
        $totals = [];
        $categories = Category::all();
        foreach ($categories as $category) {
            foreach ($category->products as $product) {
                $totals[$category->id][] = $product->reviews->count();
            }
        }

        return $totals;
    }
}
