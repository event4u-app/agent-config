<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
class CustomsDeclaration
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 12)]
    private string $hsCode = '';

    #[ORM\Column]
    private int $declaredValueCents = 0;
}
