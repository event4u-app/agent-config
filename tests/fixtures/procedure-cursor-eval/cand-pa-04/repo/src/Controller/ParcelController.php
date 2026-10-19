<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class ParcelController extends AbstractController
{
    #[Route('/parcels', methods: ['GET'])]
    public function list(): JsonResponse
    {
        return $this->json([]);
    }
}
