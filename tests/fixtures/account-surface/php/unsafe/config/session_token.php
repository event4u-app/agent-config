<?php

/**
 * Fixture for the `token-verify-off` class. Planted defect, never shipped code.
 */
return [
    'issuer' => 'https://id.example.test',

    // PLANTED: signature verification is switched off, so any self-signed
    // token the caller supplies is accepted as this issuer's.
    'verify' => false,

    'leeway' => 60,
];
