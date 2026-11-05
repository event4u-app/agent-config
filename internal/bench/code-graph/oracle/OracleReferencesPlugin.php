<?php

declare(strict_types=1);

use Psalm\Internal\Codebase\CodeUseGraph;
use Psalm\Plugin\EventHandler\AfterAnalysisInterface;
use Psalm\Plugin\EventHandler\Event\AfterAnalysisEvent;

// Answers many `--find-references-to` questions from ONE Psalm analysis. Psalm's CLI
// takes a single symbol per run, and a run over a large subject is minutes; the
// oracle's caller closure needs dozens of symbols per round. After analysis this
// reads one symbol per line from /subject/.oracle/symbols.txt and writes one JSON
// line per symbol to /subject/.oracle/references.jsonl, through the same
// Codebase::findReferencesToSymbol the CLI flag calls. The CLI must still be given
// one --find-references-to, because that flag is what turns location collection on.
final class OracleReferencesPlugin implements AfterAnalysisInterface
{
    private const IN = '/subject/.oracle/symbols.txt';
    private const OUT = '/subject/.oracle/references.jsonl';
    private const ROOT = '/subject/';

    public static function afterAnalysis(AfterAnalysisEvent $event): void
    {
        if (!is_file(self::IN)) {
            return;
        }
        $codebase = $event->getCodebase();
        $symbols = file(self::IN, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $out = fopen(self::OUT, 'w');
        if ($out === false) {
            throw new RuntimeException('cannot write ' . self::OUT);
        }

        foreach ($symbols as $symbol) {
            $sites = [];
            $error = null;
            try {
                $locations = $codebase->findReferencesToSymbol($symbol);
                if (str_contains($symbol, '::') && !str_contains($symbol, '::$')) {
                    // Psalm 7 files a call whose return value is used under the method's
                    // RETURN node, and findReferencesToSymbol reads only the call node —
                    // so `if ($g->isSafe($u))` was invisible to the CLI flag.
                    $locations += $codebase->code_use_graph->getReferenceLocations(
                        CodeUseGraph::functionLikeReturnNode(strtolower($symbol)),
                    );
                }
                foreach ($locations as $location) {
                    $file = $location->file_path;
                    if (str_starts_with($file, self::ROOT)) {
                        $file = substr($file, strlen(self::ROOT));
                    }
                    $sites[] = ['file' => $file, 'line' => $location->getLineNumber()];
                }
            } catch (Throwable $e) {
                $error = $e->getMessage();
            }
            fwrite($out, json_encode(['symbol' => $symbol, 'sites' => $sites, 'error' => $error], JSON_UNESCAPED_SLASHES) . "\n");
        }
        fclose($out);
    }
}
