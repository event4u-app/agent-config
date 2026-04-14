<?php

declare(strict_types=1);

namespace Event4u\AgentConfig;

use Composer\Composer;
use Composer\EventDispatcher\EventSubscriberInterface;
use Composer\IO\IOInterface;
use Composer\Plugin\PluginInterface;
use Composer\Script\Event;
use Composer\Script\ScriptEvents;

class AgentConfigPlugin implements PluginInterface, EventSubscriberInterface
{
    private IOInterface $io;

    public function activate(Composer $composer, IOInterface $io): void
    {
        $this->io = $io;
    }

    public function deactivate(Composer $composer, IOInterface $io): void {}

    public function uninstall(Composer $composer, IOInterface $io): void {}

    public static function getSubscribedEvents(): array
    {
        return [
            ScriptEvents::POST_INSTALL_CMD => 'install',
            ScriptEvents::POST_UPDATE_CMD => 'install',
        ];
    }

    public function install(Event $event): void
    {
        $packageDir = dirname(__DIR__);
        $projectRoot = dirname($event->getComposer()->getConfig()->get('vendor-dir'));

        $this->syncDirectory($packageDir . '/.augment', $projectRoot . '/.augment');
        $this->copyIfMissing($packageDir . '/AGENTS.md', $projectRoot . '/AGENTS.md');
        $this->copyIfMissing($packageDir . '/.github/copilot-instructions.md', $projectRoot . '/.github/copilot-instructions.md');
        $this->createToolSymlinks($packageDir, $projectRoot);
        $this->createSkillSymlinks($packageDir, $projectRoot);
        $this->generateWindsurfrules($packageDir, $projectRoot);
        $this->createGeminiMd($projectRoot);

        $this->io->write('<info>event4u/agent-config: agent configuration installed.</info>');
    }

    /**
     * Syncs all files from $source to $dest, overwriting existing files.
     * Deletes files in $dest that don't exist in $source (stale cleanup).
     * Removes empty directories after cleanup.
     */
    private function syncDirectory(string $source, string $dest): void
    {
        if (!is_dir($source)) {
            return;
        }

        if (!is_dir($dest)) {
            mkdir($dest, 0755, true);
        }

        // Step 1: Collect manifest of all source files (relative paths)
        $sourceFiles = $this->collectFiles($source);

        // Step 2: Copy all source files to dest
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($source, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST,
        );

        foreach ($iterator as $item) {
            $relative = substr((string) $item, strlen($source) + 1);
            $target = $dest . '/' . $relative;

            if ($item->isDir()) {
                if (!is_dir($target)) {
                    mkdir($target, 0755, true);
                }

                continue;
            }

            copy((string) $item, $target);
        }

        // Step 3: Delete stale files in dest that don't exist in source
        $destFiles = $this->collectFiles($dest);
        $staleFiles = array_diff($destFiles, $sourceFiles);

        foreach ($staleFiles as $staleFile) {
            $stalePath = $dest . '/' . $staleFile;
            if (is_file($stalePath)) {
                unlink($stalePath);
                $this->io->write(sprintf('<comment>  Removed stale: %s</comment>', $staleFile));
            }
        }

        // Step 4: Remove empty directories
        $this->removeEmptyDirectories($dest);
    }

    /**
     * Collects all file paths relative to $dir.
     *
     * @return array<int, string>
     */
    private function collectFiles(string $dir): array
    {
        if (!is_dir($dir)) {
            return [];
        }

        $files = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
        );

        foreach ($iterator as $item) {
            if ($item->isFile()) {
                $files[] = substr((string) $item, strlen($dir) + 1);
            }
        }

        return $files;
    }

    /**
     * Removes empty directories recursively (bottom-up).
     */
    private function removeEmptyDirectories(string $dir): void
    {
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($iterator as $item) {
            if ($item->isDir()) {
                $path = (string) $item;
                // Check if directory is empty (scandir returns . and .. only)
                if (count((array) scandir($path)) === 2) {
                    rmdir($path);
                }
            }
        }
    }

    /**
     * Copies $source to $dest only if $dest does not exist yet.
     * This preserves project-specific customizations.
     */
    private function copyIfMissing(string $source, string $dest): void
    {
        if (!file_exists($source) || file_exists($dest)) {
            return;
        }

        $dir = dirname($dest);

        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        copy($source, $dest);
    }

    /**
     * Creates symlinks for ALL rules in .augment/rules/ to tool-specific directories.
     * Reads directly from the project's .augment/rules/ (which includes package + project rules).
     * Falls back to copy if symlink creation fails.
     */
    private function createToolSymlinks(string $packageDir, string $projectRoot): void
    {
        $rulesDir = $projectRoot . '/.augment/rules';
        if (!is_dir($rulesDir)) {
            return;
        }

        // Collect all .md files from .augment/rules/
        $rules = array_map(
            static fn (\SplFileInfo $f): string => $f->getFilename(),
            array_filter(
                iterator_to_array(new \DirectoryIterator($rulesDir)),
                static fn (\SplFileInfo $f): bool => $f->isFile() && $f->getExtension() === 'md',
            ),
        );

        $toolDirs = [
            '.claude/rules' => '../../.augment/rules',
            '.cursor/rules' => '../../.augment/rules',
            '.clinerules' => '../.augment/rules',
        ];

        foreach ($toolDirs as $dir => $relPrefix) {
            $targetDir = $projectRoot . '/' . $dir;
            if (!is_dir($targetDir)) {
                mkdir($targetDir, 0755, true);
            }

            foreach ($rules as $rule) {
                $link = $targetDir . '/' . $rule;
                $target = $relPrefix . '/' . $rule;

                if (is_link($link) || file_exists($link)) {
                    if (is_link($link)) {
                        unlink($link);
                    } else {
                        continue; // Don't overwrite real files
                    }
                }

                if (!@symlink($target, $link)) {
                    // Fallback: copy
                    $sourcePath = $rulesDir . '/' . $rule;
                    if (file_exists($sourcePath)) {
                        copy($sourcePath, $link);
                    }
                }
            }
        }
    }

    /**
     * Creates symlinks for universal skills in .claude/skills/.
     * Falls back to copy if symlink creation fails.
     */
    /**
     * Creates .claude/skills/ symlinks for ALL skill directories in .augment/skills/.
     * Reads directly from the project's .augment/skills/ (package + project skills).
     */
    private function createSkillSymlinks(string $packageDir, string $projectRoot): void
    {
        $skillsDir = $projectRoot . '/.augment/skills';
        if (!is_dir($skillsDir)) {
            return;
        }

        // Collect all skill directories
        $skills = array_map(
            static fn (\SplFileInfo $f): string => $f->getFilename(),
            array_filter(
                iterator_to_array(new \DirectoryIterator($skillsDir)),
                static fn (\SplFileInfo $f): bool => $f->isDir() && !$f->isDot(),
            ),
        );

        $targetDir = $projectRoot . '/.claude/skills';
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0755, true);
        }

        foreach ($skills as $skill) {
            $link = $targetDir . '/' . $skill;
            $target = '../../.augment/skills/' . $skill;

            if (is_link($link)) {
                unlink($link);
            } elseif (is_dir($link)) {
                continue; // Don't overwrite real directories
            }

            if (!@symlink($target, $link)) {
                // Fallback: copy SKILL.md
                $sourcePath = $skillsDir . '/' . $skill . '/SKILL.md';
                if (file_exists($sourcePath)) {
                    if (!is_dir($link)) {
                        mkdir($link, 0755, true);
                    }
                    copy($sourcePath, $link . '/SKILL.md');
                }
            }
        }
    }

    /**
     * Generates .windsurfrules by concatenating all universal rules.
     */
    /**
     * Generates .windsurfrules from ALL .md files in .augment/rules/.
     */
    private function generateWindsurfrules(string $packageDir, string $projectRoot): void
    {
        $rulesDir = $projectRoot . '/.augment/rules';
        if (!is_dir($rulesDir)) {
            return;
        }

        $rules = glob($rulesDir . '/*.md') ?: [];
        sort($rules);

        $parts = ["# Auto-generated from .augment/rules/ — do not edit directly\n"];

        foreach ($rules as $path) {
            $content = (string) file_get_contents($path);
            // Strip frontmatter
            if (str_starts_with($content, '---')) {
                $end = strpos($content, '---', 3);
                if (false !== $end) {
                    $content = ltrim(substr($content, $end + 3), "\n");
                }
            }

            $parts[] = "---\n\n" . trim($content) . "\n";
        }

        file_put_contents($projectRoot . '/.windsurfrules', implode("\n", $parts) . "\n");
    }

    /**
     * Creates GEMINI.md symlink to AGENTS.md.
     */
    private function createGeminiMd(string $projectRoot): void
    {
        $link = $projectRoot . '/GEMINI.md';
        if (file_exists($link) && !is_link($link)) {
            return; // Don't overwrite real files
        }

        if (is_link($link)) {
            unlink($link);
        }

        if (!@symlink('AGENTS.md', $link)) {
            // Fallback: copy
            $source = $projectRoot . '/AGENTS.md';
            if (file_exists($source)) {
                copy($source, $link);
            }
        }
    }
}
