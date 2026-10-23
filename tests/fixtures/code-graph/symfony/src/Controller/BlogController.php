<?php

namespace App\Controller;

use App\Service\Mailer;
use App\Service\Clock as SystemClock;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/blog')]
class BlogController extends AbstractController
{
    public function __construct(
        private Mailer $mailer,
        private readonly SystemClock $clock,
        private string $locale = 'en',
    ) {
    }

    #[Route('/list', name: 'blog_list', methods: ['GET'])]
    public function list(): Response
    {
        $this->cache->get('/not-a-route');
        return $this->render('blog/list.html.twig', ['posts' => []]);
    }

    #[Route('/{id}', name: 'blog_show', methods: ['POST', 'PUT'])]
    #[IsGranted('ROLE_USER', subject: Post::class)]
    public function show(int $id): Response
    {
        return $this->render('blog/missing.html.twig');
    }
}
