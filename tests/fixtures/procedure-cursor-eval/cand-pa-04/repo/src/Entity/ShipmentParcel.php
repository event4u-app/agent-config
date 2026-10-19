<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
class ShipmentParcel
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;

    #[ORM\Column]
    private int $weightGrams = 0;

    #[ORM\ManyToOne(targetEntity: CarrierQuote::class)]
    private ?CarrierQuote $acceptedQuote = null;

    #[ORM\OneToOne(targetEntity: CustomsDeclaration::class)]
    private ?CustomsDeclaration $customsDeclaration = null;
}
