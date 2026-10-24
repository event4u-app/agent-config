<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
class Comment
{
    #[ORM\ManyToOne(targetEntity: 'App\Entity\Post')]
    private $post;
}
