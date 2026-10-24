<?php

namespace App\Entity;

use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'blog_posts')]
class Post
{
    #[ORM\ManyToOne(targetEntity: Author::class, inversedBy: 'posts')]
    private ?Author $author = null;

    #[ORM\OneToMany(targetEntity: Comment::class, mappedBy: 'post')]
    private Collection $comments;

    #[ORM\ManyToMany]
    #[ORM\JoinTable(name: 'post_tags')]
    private ?PostTag $tag = null;
}
