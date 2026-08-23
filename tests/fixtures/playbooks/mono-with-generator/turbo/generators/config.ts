// The repository's OWN component generator. This is the thing the suite must
// propose before it reaches for a shipped skill — it encodes decisions this
// monorepo already made (file layout, barrel export, test co-location, the
// project's own styling convention) that no generic skill can know.
import type { PlopTypes } from '@turbo/gen';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
    plop.setGenerator('component', {
        description: 'Add a component to @org/ui, wired into the barrel and with a test',
        prompts: [
            { type: 'input', name: 'name', message: 'Component name (PascalCase):' },
        ],
        actions: [
            {
                type: 'add',
                path: 'packages/ui/src/{{pascalCase name}}/{{pascalCase name}}.tsx',
                templateFile: 'templates/component.tsx.hbs',
            },
            {
                type: 'add',
                path: 'packages/ui/src/{{pascalCase name}}/{{pascalCase name}}.test.tsx',
                templateFile: 'templates/component.test.tsx.hbs',
            },
            {
                type: 'append',
                path: 'packages/ui/src/index.ts',
                template: "export * from './{{pascalCase name}}/{{pascalCase name}}';",
            },
        ],
    });
}
