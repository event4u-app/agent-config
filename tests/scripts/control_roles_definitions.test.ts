import { describe, expect, it } from 'vitest';

import { definedComponents } from '../../src/scripts/_lib/control_roles.js';

const defs = (text: string, rel = 'packages/ui/src/components/select.tsx') => definedComponents(rel, text);

// road-to-a-control-that-matches-its-neighbours 3.10: definitions are read by a
// scanner that knows strings, comments, regex literals, templates and scope.
describe('definedComponents — module-level definitions only', () => {
    it('reads the shapes a primitive is written in', () => {
        expect(defs('export function Select() {}')).toEqual(['Select']);
        expect(defs('export default function Select() {}')).toEqual(['Select']);
        expect(defs('export const Select = forwardRef(() => null);')).toEqual(['Select']);
        expect(defs('export class Select {}')).toEqual(['Select']);
        expect(defs('function Textarea() {\n  return <textarea />;\n}\nexport { Textarea };')).toEqual(['Textarea']);
        expect(defs('const Field = () => null;\nexport { Field as Input };')).toEqual(['Input']);
    });

    it('ratification counter-example: an export inside a namespace is not a module definition', () => {
        expect(defs('namespace Kit {\n  export function Select() {}\n}')).toEqual([]);
        expect(defs('export namespace Kit {\n  export const Select = 1;\n}')).toEqual([]);
        expect(defs('declare module "kit" {\n  export function Select(): void;\n}')).toEqual([]);
        expect(defs('declare global {\n  export class Select {}\n}')).toEqual([]);
    });

    it('ratification counter-example: a declaration inside a regex literal is not code', () => {
        expect(defs('const re = /export function Select/;')).toEqual([]);
        expect(defs('const re = /function Select() {}/;\nexport { Select };')).toEqual([]);
        expect(defs("if (/export const Select = /.test(s)) run();")).toEqual([]);
        // A division is not a regex: the definition after it is still read.
        expect(defs('const half = a / 2 / b;\nexport function Select() {}')).toEqual(['Select']);
    });

    it('a declaration in a string, template or comment is not code', () => {
        expect(defs('const s = "export function Select() {}";')).toEqual([]);
        expect(defs("const s = `export function Select() {} ${'x'}`;")).toEqual([]);
        expect(defs('// export function Select() {}\n/* export class Select {} */')).toEqual([]);
        expect(defs('const t = `${ { a: 1 }.a }`;\nexport function Select() {}')).toEqual(['Select']);
    });

    it('a nested declaration exported by name is not a module binding', () => {
        expect(defs('function outer() {\nfunction Textarea() {}\n}\nexport { Textarea };')).toEqual([]);
        expect(defs('if (x) {\nconst Select = 1;\n}\nexport { Select };')).toEqual([]);
    });

    it('re-exports and imported bindings are not definitions', () => {
        expect(defs("export { Select } from './select';")).toEqual([]);
        expect(defs("import { Select } from 'kit';\nexport { Select };")).toEqual([]);
        expect(defs("import Kit, { Field as Input } from 'kit';\nexport { Input };")).toEqual([]);
        expect(defs("export * from './select';")).toEqual([]);
    });

    it('JSX after a definition does not hide the next one', () => {
        const tsx = [
            'export function Select() {',
            "  return <div className=\"a\"><p>Don't</p><Icon a={x} /> <b>{n}</b></div>;",
            '}',
            'export const Combobox = () => <span>1 / 2</span>;',
        ].join('\n');
        expect(defs(tsx)).toEqual(['Select', 'Combobox']);
    });

    it('names a Blade or single-file component by its path', () => {
        expect(definedComponents('resources/views/components/forms/select.blade.php', '')).toEqual(['x-forms.select']);
        expect(definedComponents('src/components/Select.vue', '<template><select /></template>')).toEqual(['Select']);
    });
});
