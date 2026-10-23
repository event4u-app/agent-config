/**
 * NestJS: `@Controller('users')` + `@Get(':id')` → `GET /users/:id`
 * --routes-to--> the decorated method; `constructor(private readonly s: UsersService)`
 * in an `@Injectable()` / `@Controller()` class → class --injects--> UsersService
 * when the file names that class. An object-form prefix (`@Controller({ path })`),
 * an array of paths, and a custom provider token (`@Inject('X')`) are not
 * followed; a global prefix set in `main.ts` is not applied.
 */
import { npmRoots } from './shared/detect.js';
import { annotationRoutes } from './shared/extractors.js';
import { constructorInjection } from './shared/js.js';
import { makeKit } from './shared/kit.js';
import type { ConventionProvider } from './types.js';

const EXTS = ['.ts', '.js'];

export const nestjsProvider: ConventionProvider = {
    id: 'nestjs',
    detect: (probe) => npmRoots(probe, ['@nestjs/core']),
    build: (input) => {
        const kit = makeKit(input);
        annotationRoutes(kit, {
            exts: EXTS,
            route: /@(?<verb>Get|Post|Put|Patch|Delete|Options|Head|All)\(\s*(?:(['"`])(?<path>[^'"`]*)\2\s*)?\)/g,
            verb: (m) => (m.groups?.['verb'] === 'All' ? 'ANY' : (m.groups?.['verb'] as string)),
            prefix: /@Controller\(\s*(?:(['"`])(?<path>[^'"`]*)\1\s*)?\)/g,
        });
        constructorInjection(kit, {
            exts: EXTS,
            classDecorator: /@(?:Injectable|Controller|Resolver|WebSocketGateway)\(/,
        });
        return kit.result();
    },
};
