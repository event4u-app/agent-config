<?php

declare(strict_types=1);

// Reads "<file>:<line>" pairs from stdin, one per line, and prints for each the
// Psalm symbol of the narrowest enclosing class method, function or class:
//   <file>:<line>\t<symbol>      (Ns\Class::method, Ns\function, Ns\Class)
//   <file>:<line>\t-             (file scope: routes, config, a bare script)
// The oracle uses it to climb from a reference site to the next symbol whose
// references it asks Psalm for. Parsing is nikic/php-parser, the parser Psalm
// itself ships, so a site resolves the way Psalm resolved it.

require '/opt/composer/vendor/autoload.php';

use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;
use PhpParser\NodeVisitor\NameResolver;
use PhpParser\ParserFactory;

final class ScopeCollector extends NodeVisitorAbstract
{
    /** @var list<array{int, int, string}> */
    public array $scopes = [];

    public function enterNode(Node $node): null
    {
        if ($node instanceof Node\Stmt\ClassLike && $node->namespacedName !== null) {
            $class = $node->namespacedName->toString();
            $this->scopes[] = [$node->getStartLine(), $node->getEndLine(), $class];
            foreach ($node->getMethods() as $method) {
                $this->scopes[] = [$method->getStartLine(), $method->getEndLine(), $class . '::' . $method->name->toString()];
            }
        } elseif ($node instanceof Node\Stmt\Function_ && $node->namespacedName !== null) {
            $this->scopes[] = [$node->getStartLine(), $node->getEndLine(), $node->namespacedName->toString()];
        }

        return null;
    }
}

$parser = (new ParserFactory())->createForHostVersion();
$cache = [];

while (($line = fgets(STDIN)) !== false) {
    $site = trim($line);
    if ($site === '' || !preg_match('/^(.+):(\d+)$/', $site, $m)) {
        continue;
    }
    [$file, $at] = [$m[1], (int) $m[2]];

    if (!array_key_exists($file, $cache)) {
        $collector = new ScopeCollector();
        try {
            $traverser = new NodeTraverser(new NameResolver(), $collector);
            $traverser->traverse($parser->parse((string) file_get_contents($file)) ?? []);
            $cache[$file] = $collector->scopes;
        } catch (Throwable) {
            $cache[$file] = [];
        }
    }

    $best = '-';
    $span = PHP_INT_MAX;
    foreach ($cache[$file] as [$start, $end, $symbol]) {
        if ($start <= $at && $at <= $end && $end - $start < $span) {
            [$best, $span] = [$symbol, $end - $start];
        }
    }
    echo $site, "\t", $best, "\n";
}
