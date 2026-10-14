<?php

/**
 * Safe twin of the `token-verify-off` fixture. A detector must stay silent here.
 */
return [
    'issuer' => 'https://id.example.test',
    'audience' => 'https://app.example.test',
    'verify' => true,
    'algorithms' => ['RS256'],
    'leeway' => 60,
];
