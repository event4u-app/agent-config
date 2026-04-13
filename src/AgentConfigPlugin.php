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

        $this->io->write('<info>galawork/agent-config: agent configuration installed.</info>');
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
}
