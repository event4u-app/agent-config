import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * A project with an npm lock (v3), a composer lock, a Dockerfile and a CI
 * workflow, planted with one case per systems drift class:
 *   is-even         declared, nothing uses it                          → SY-1
 *   js-tokens       imported by production code, only react installs it → SY-2
 *   eslint          a dev dependency imported by src/lint.ts            → SY-3
 *   php             Dockerfile 8.2 against composer.json ^8.3           → SY-4
 * and with uses that carry no import: vitest (script), eslint-plugin-react
 * (tool config), phpunit (composer script), spatie/laravel-ray (Laravel
 * auto-discovery).
 */
export function writeSystemsFixture(): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-systems-')));
    const w = (rel: string, body: string | object): void => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), typeof body === 'string' ? body : `${JSON.stringify(body, null, 2)}\n`);
    };
    w('package.json', {
        name: 'shop',
        engines: { node: '>=20' },
        scripts: { test: 'vitest run', lint: 'eslint .' },
        dependencies: { react: '^18.2.0', lodash: '^4.17.0', 'is-even': '^1.0.0' },
        devDependencies: { eslint: '^8.0.0', 'eslint-plugin-react': '^7.0.0', vitest: '^1.0.0' },
    });
    w('package-lock.json', {
        name: 'shop',
        lockfileVersion: 3,
        packages: {
            '': {
                name: 'shop',
                dependencies: { react: '^18.2.0', lodash: '^4.17.0', 'is-even': '^1.0.0' },
                devDependencies: { eslint: '^8.0.0', 'eslint-plugin-react': '^7.0.0', vitest: '^1.0.0' },
            },
            'node_modules/react': { version: '18.2.0', resolved: 'https://registry.npmjs.org/react/-/react-18.2.0.tgz', dependencies: { 'loose-envify': '^1.1.0' } },
            'node_modules/loose-envify': { version: '1.4.0', resolved: 'https://registry.npmjs.org/loose-envify/-/loose-envify-1.4.0.tgz', dependencies: { 'js-tokens': '^3.0.0 || ^4.0.0' }, bin: { 'loose-envify': 'cli.js' } },
            'node_modules/js-tokens': { version: '4.0.0', resolved: 'https://registry.npmjs.org/js-tokens/-/js-tokens-4.0.0.tgz' },
            'node_modules/lodash': { version: '4.17.21', resolved: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz' },
            'node_modules/is-even': { version: '1.0.0', resolved: 'https://registry.npmjs.org/is-even/-/is-even-1.0.0.tgz', dependencies: { 'is-odd': '^0.1.2' } },
            'node_modules/is-odd': { version: '0.1.2', resolved: 'https://registry.npmjs.org/is-odd/-/is-odd-0.1.2.tgz' },
            'node_modules/eslint': { version: '8.57.0', dev: true, resolved: 'https://registry.npmjs.org/eslint/-/eslint-8.57.0.tgz', bin: { eslint: 'bin/eslint.js' } },
            'node_modules/eslint-plugin-react': { version: '7.34.1', dev: true, resolved: 'https://registry.npmjs.org/eslint-plugin-react/-/eslint-plugin-react-7.34.1.tgz', peerDependencies: { eslint: '^8' } },
            'node_modules/vitest': { version: '1.6.0', dev: true, resolved: 'https://registry.npmjs.org/vitest/-/vitest-1.6.0.tgz', bin: { vitest: 'vitest.mjs' } },
        },
    });
    w('.eslintrc.json', { plugins: ['react'] });
    w('src/app.ts', "import { useState } from 'react';\nimport map from 'lodash/map';\nimport jsTokens from 'js-tokens';\nexport const app = [useState, map, jsTokens];\n");
    w('src/lint.ts', "import { ESLint } from 'eslint';\nexport const lint = new ESLint();\n");
    w('composer.json', {
        name: 'acme/shop',
        require: { php: '^8.3', 'laravel/framework': '^11.0', 'guzzlehttp/guzzle': '^7.8', 'spatie/laravel-ray': '^1.0' },
        'require-dev': { 'phpunit/phpunit': '^11.0' },
        scripts: { test: 'phpunit' },
        autoload: { 'psr-4': { 'App\\': 'app/' } },
    });
    w('composer.lock', {
        packages: [
            { name: 'laravel/framework', version: 'v11.9.2', require: { php: '^8.2', 'guzzlehttp/guzzle': '^7.8', 'symfony/console': '^7.0' }, autoload: { 'psr-4': { 'Illuminate\\': 'src/Illuminate/' } }, 'notification-url': 'https://packagist.org/downloads/' },
            { name: 'guzzlehttp/guzzle', version: '7.8.1', require: { 'psr/http-client': '^1.0' }, autoload: { 'psr-4': { 'GuzzleHttp\\': 'src/' }, files: ['src/functions_include.php'] }, 'notification-url': 'https://packagist.org/downloads/' },
            { name: 'psr/http-client', version: '1.0.3', autoload: { 'psr-4': { 'Psr\\Http\\Client\\': 'src/' } }, 'notification-url': 'https://packagist.org/downloads/' },
            { name: 'symfony/console', version: 'v7.0.7', autoload: { 'psr-4': { 'Symfony\\Component\\Console\\': '' } }, 'notification-url': 'https://packagist.org/downloads/' },
            { name: 'spatie/laravel-ray', version: '1.36.0', autoload: { 'psr-4': { 'Spatie\\LaravelRay\\': 'src/' } }, extra: { laravel: { providers: ['Spatie\\LaravelRay\\RayServiceProvider'] } }, 'notification-url': 'https://packagist.org/downloads/' },
        ],
        'packages-dev': [{ name: 'phpunit/phpunit', version: '11.1.3', bin: ['phpunit'], autoload: { classmap: ['src/'] }, 'notification-url': 'https://packagist.org/downloads/' }],
        platform: { php: '^8.3' },
    });
    w('app/Http/Client.php', '<?php\nnamespace App\\Http;\n\nuse GuzzleHttp\\Client as Guzzle;\nuse Illuminate\\Support\\Facades\\Log;\n\nclass Client\n{\n    public function make(): Guzzle\n    {\n        Log::info(\'make\');\n        return new Guzzle();\n    }\n}\n');
    w('Dockerfile', 'FROM php:8.2-fpm\nWORKDIR /app\n');
    w('.github/workflows/ci.yml', 'name: ci\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npx eslint .\n');
    return root;
}
