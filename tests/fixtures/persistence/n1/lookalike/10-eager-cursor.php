<?php
// FIXTURE: look-alike — cursor() source with eager-loaded tags via with(); loop access is in-memory.

namespace App\Services;

use App\Models\Article;

class TagCloudService
{
    public function cloud(): array
    {
        $cloud = [];
        foreach (Article::with('tags')->cursor() as $article) {
            foreach ($article->tags as $tag) {
                $cloud[$tag->name] = ($cloud[$tag->name] ?? 0) + 1;
            }
        }

        return $cloud;
    }
}
