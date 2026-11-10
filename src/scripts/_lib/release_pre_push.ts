import { local_release_gate_argv } from '../release_publication.js';

/**
 * Everything the release runs before its push, in order: the local release
 * gates, then the CI mirror on the release head. The pre-push hook refuses a
 * head with no green mirror stamp, and the release creates that head itself
 * (the bump commit, and on a resume the era-split commit), so no stamp taken
 * before the run can match it. Measured on 20.2.0: two refused pushes.
 */
export function pre_push_argvs(): string[][] {
    return [local_release_gate_argv(), ['./scripts-run', 'src/scripts/ci_mirror']];
}
