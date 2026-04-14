<?php

declare(strict_types=1);

namespace Event4u\AgentConfig\Tests;

use Composer\Composer;
use Composer\Config;
use Composer\IO\NullIO;
use Event4u\AgentConfig\AgentConfigPlugin;
use PHPUnit\Framework\TestCase;

class AgentConfigPluginTest extends TestCase
{
    private string $tmpDir;
    private AgentConfigPlugin $plugin;

    protected function setUp(): void
    {
        $this->tmpDir = sys_get_temp_dir() . '/agent-config-test-' . uniqid();
        mkdir($this->tmpDir, 0755, true);

        $this->plugin = new AgentConfigPlugin();
        $composer = $this->createMock(Composer::class);
        $this->plugin->activate($composer, new NullIO());
    }

    protected function tearDown(): void
    {
        $this->removeDir($this->tmpDir);
    }

    // --- shouldCopy() ---

    public function testShouldCopyReturnsTrueForRules(): void
    {
        $this->assertTrue($this->callPrivate('shouldCopy', 'rules/php-coding.md'));
        $this->assertTrue($this->callPrivate('shouldCopy', 'rules/scope-control.md'));
    }

    public function testShouldCopyReturnsFalseForSkills(): void
    {
        $this->assertFalse($this->callPrivate('shouldCopy', 'skills/coder/SKILL.md'));
    }

    public function testShouldCopyReturnsFalseForCommands(): void
    {
        $this->assertFalse($this->callPrivate('shouldCopy', 'commands/compress.md'));
    }

    public function testShouldCopyReturnsFalseForGuidelines(): void
    {
        $this->assertFalse($this->callPrivate('shouldCopy', 'guidelines/php/controllers.md'));
    }

    public function testShouldCopyReturnsFalseForRootFiles(): void
    {
        $this->assertFalse($this->callPrivate('shouldCopy', 'README.md'));
    }

    public function testShouldCopyReturnsFalseForTemplates(): void
    {
        $this->assertFalse($this->callPrivate('shouldCopy', 'templates/roadmaps.md'));
    }

    // --- getRelativePath() ---

    public function testGetRelativePathSameParent(): void
    {
        $from = $this->tmpDir . '/a';
        $to = $this->tmpDir . '/a/file.txt';
        mkdir($from, 0755, true);
        file_put_contents($to, 'x');

        $result = $this->callPrivate('getRelativePath', $from, $to);
        $this->assertSame('file.txt', $result);
    }

    public function testGetRelativePathOneLevelUp(): void
    {
        $from = $this->tmpDir . '/a/b';
        $to = $this->tmpDir . '/a/file.txt';
        mkdir($from, 0755, true);
        file_put_contents($to, 'x');

        $result = $this->callPrivate('getRelativePath', $from, $to);
        $this->assertSame('../file.txt', $result);
    }

    public function testGetRelativePathDeepNesting(): void
    {
        $from = $this->tmpDir . '/project/.augment/skills/coder';
        $to = $this->tmpDir . '/vendor/event4u/agent-config/.augment/skills/coder/SKILL.md';
        mkdir($from, 0755, true);
        mkdir(dirname($to), 0755, true);
        file_put_contents($to, 'x');

        $result = $this->callPrivate('getRelativePath', $from, $to);
        $this->assertStringContainsString('vendor/event4u/agent-config/.augment/skills/coder/SKILL.md', $result);
        $this->assertStringStartsWith('../', $result);
    }

    // --- syncHybrid() integration ---

    public function testSyncHybridCopiesRules(): void
    {
        $package = $this->createPackageStructure();
        $project = $this->tmpDir . '/project/.augment';

        $this->callPrivate('syncHybrid', $package, $project);

        $rulePath = $project . '/rules/php-coding.md';
        $this->assertFileExists($rulePath);
        $this->assertFalse(is_link($rulePath), 'Rules must be real copies, not symlinks');
        $this->assertSame('# PHP Coding', file_get_contents($rulePath));
    }

    public function testSyncHybridSymlinksSkills(): void
    {
        $package = $this->createPackageStructure();
        $project = $this->tmpDir . '/project/.augment';

        $this->callPrivate('syncHybrid', $package, $project);

        $skillPath = $project . '/skills/coder/SKILL.md';
        $this->assertFileExists($skillPath);
        $this->assertTrue(is_link($skillPath), 'Skills must be symlinks');
        $this->assertSame('# Coder', file_get_contents($skillPath));
    }

    public function testSyncHybridSymlinksCommands(): void
    {
        $package = $this->createPackageStructure();
        $project = $this->tmpDir . '/project/.augment';

        $this->callPrivate('syncHybrid', $package, $project);

        $cmdPath = $project . '/commands/commit.md';
        $this->assertFileExists($cmdPath);
        $this->assertTrue(is_link($cmdPath), 'Commands must be symlinks');
    }

    public function testSyncHybridSymlinksRootFiles(): void
    {
        $package = $this->createPackageStructure();
        $project = $this->tmpDir . '/project/.augment';

        $this->callPrivate('syncHybrid', $package, $project);

        $readmePath = $project . '/README.md';
        $this->assertFileExists($readmePath);
        $this->assertTrue(is_link($readmePath), 'Root files must be symlinks');
    }

    public function testSyncHybridRemovesStaleFiles(): void
    {
        $package = $this->createPackageStructure();
        $project = $this->tmpDir . '/project/.augment';

        // First sync
        $this->callPrivate('syncHybrid', $package, $project);

        // Add a stale file to project
        file_put_contents($project . '/skills/old-skill/SKILL.md', 'stale');
        mkdir($project . '/skills/old-skill', 0755, true);
        file_put_contents($project . '/skills/old-skill/SKILL.md', 'stale');

        // Re-sync
        $this->callPrivate('syncHybrid', $package, $project);

        $this->assertFileDoesNotExist($project . '/skills/old-skill/SKILL.md');
    }

    public function testSyncHybridRemovesBrokenSymlinks(): void
    {
        $package = $this->createPackageStructure();
        $project = $this->tmpDir . '/project/.augment';

        // First sync
        $this->callPrivate('syncHybrid', $package, $project);

        // Create a broken symlink manually
        $brokenLink = $project . '/skills/broken/SKILL.md';
        mkdir(dirname($brokenLink), 0755, true);
        symlink('/nonexistent/path', $brokenLink);
        $this->assertTrue(is_link($brokenLink));

        // Re-sync should clean it
        $this->callPrivate('syncHybrid', $package, $project);

        $this->assertFalse(is_link($brokenLink));
    }

    public function testSyncHybridMigrationReplacesRealFilesWithSymlinks(): void
    {
        $package = $this->createPackageStructure();
        $project = $this->tmpDir . '/project/.augment';

        // Simulate old copy-based sync (real files everywhere)
        mkdir($project . '/skills/coder', 0755, true);
        file_put_contents($project . '/skills/coder/SKILL.md', '# Old copy');
        $this->assertFalse(is_link($project . '/skills/coder/SKILL.md'));

        // Run hybrid sync — should replace with symlink
        $this->callPrivate('syncHybrid', $package, $project);

        $this->assertTrue(is_link($project . '/skills/coder/SKILL.md'), 'Old real file should become a symlink');
        $this->assertSame('# Coder', file_get_contents($project . '/skills/coder/SKILL.md'));
    }

    public function testSyncHybridMigrationKeepsRulesAsCopies(): void
    {
        $package = $this->createPackageStructure();
        $project = $this->tmpDir . '/project/.augment';

        // Simulate old copy-based sync
        mkdir($project . '/rules', 0755, true);
        file_put_contents($project . '/rules/php-coding.md', '# Old');

        // Run hybrid sync — rules should stay as copies
        $this->callPrivate('syncHybrid', $package, $project);

        $this->assertFalse(is_link($project . '/rules/php-coding.md'), 'Rules must remain real copies');
        $this->assertSame('# PHP Coding', file_get_contents($project . '/rules/php-coding.md'));
    }

    public function testSyncHybridIsIdempotent(): void
    {
        $package = $this->createPackageStructure();
        $project = $this->tmpDir . '/project/.augment';

        $this->callPrivate('syncHybrid', $package, $project);
        $this->callPrivate('syncHybrid', $package, $project);

        // Rules still copies
        $this->assertFalse(is_link($project . '/rules/php-coding.md'));
        $this->assertSame('# PHP Coding', file_get_contents($project . '/rules/php-coding.md'));

        // Skills still symlinks
        $this->assertTrue(is_link($project . '/skills/coder/SKILL.md'));
        $this->assertSame('# Coder', file_get_contents($project . '/skills/coder/SKILL.md'));
    }

    public function testSyncHybridReplacesSymlinkWithCopyForRules(): void
    {
        $package = $this->createPackageStructure();
        $project = $this->tmpDir . '/project/.augment';

        // Simulate someone manually created a symlink for a rule
        mkdir($project . '/rules', 0755, true);
        symlink($package . '/rules/php-coding.md', $project . '/rules/php-coding.md');
        $this->assertTrue(is_link($project . '/rules/php-coding.md'));

        // Run hybrid sync — should replace symlink with real copy
        $this->callPrivate('syncHybrid', $package, $project);

        $this->assertFalse(is_link($project . '/rules/php-coding.md'), 'Rule symlink should become a real copy');
        $this->assertSame('# PHP Coding', file_get_contents($project . '/rules/php-coding.md'));
    }

    // --- Helpers ---

    private function createPackageStructure(): string
    {
        $base = $this->tmpDir . '/package/.augment';
        mkdir($base . '/rules', 0755, true);
        mkdir($base . '/skills/coder', 0755, true);
        mkdir($base . '/commands', 0755, true);

        file_put_contents($base . '/rules/php-coding.md', '# PHP Coding');
        file_put_contents($base . '/rules/scope-control.md', '# Scope Control');
        file_put_contents($base . '/skills/coder/SKILL.md', '# Coder');
        file_put_contents($base . '/commands/commit.md', '# Commit');
        file_put_contents($base . '/README.md', '# README');

        return $base;
    }

    /**
     * @param mixed ...$args
     * @return mixed
     */
    private function callPrivate(string $method, mixed ...$args): mixed
    {
        $ref = new \ReflectionMethod($this->plugin, $method);

        return $ref->invoke($this->plugin, ...$args);
    }

    private function removeDir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );

        foreach ($iterator as $item) {
            $path = (string) $item;

            if (is_link($path) || $item->isFile()) {
                unlink($path);
            } elseif ($item->isDir()) {
                rmdir($path);
            }
        }

        rmdir($dir);
    }
}
