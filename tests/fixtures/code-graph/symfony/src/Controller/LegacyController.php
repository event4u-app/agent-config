<?php

namespace App\Controller;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;

/**
 * Old-style annotations.
 *
 * @Route("/legacy")
 */
class LegacyController
{
    /**
     * @Route("/index", methods={"GET"})
     */
    public function index()
    {
        return $this->render('legacy/index.html.twig');
    }
}
