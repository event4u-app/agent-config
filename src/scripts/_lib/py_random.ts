/**
 * Bit-exact reproduction of CPython's `random.Random` (Mersenne Twister
 * MT19937) — the subset the prediction-pool simulators need for
 * byte-identical output.
 *
 * py2ts migration (ADR-200): the simulators `poisson_sim` and `pool_winsim`
 * call `random.Random(seed)` and consume ONLY `rng.random()` and (poisson_sim)
 * `rng.shuffle(...)`. Reproducing CPython's stream bit-for-bit is the only way
 * those twins emit identical simulation output. This is a NEW library — there
 * is no `py_random.py` source (the Python side is the stdlib `random` module),
 * so the ADR-051 legacy-literal parity check does not apply to this file.
 *
 * Implementation notes:
 *   - All word operations are 32-bit unsigned (`>>> 0` masks every result).
 *   - The constant multiplies overflow 32 bits, so they use
 *     `Math.imul(a, b) >>> 0` — plain `*` would lose the low 32 bits to FP.
 *   - Integer seeding mirrors CPython's `random_seed`: `abs(n)` is split into
 *     little-endian 32-bit words and fed to `init_by_array`. BigInt is used
 *     ONLY for that split; the generator itself is pure uint32.
 *
 * Cross-checked against CPython directly (see tests/scripts/_lib/py_random.test.ts):
 *   python3 -c "import random; r=random.Random(1); print([r.random() for _ in range(5)])"
 *   python3 -c "import random; r=random.Random(7); l=list(range(10)); r.shuffle(l); print(l)"
 */

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

export class PyRandom {
    private mt = new Uint32Array(N);
    private mti = N + 1;

    constructor(seed?: number | bigint) {
        if (seed === undefined || seed === null) {
            // CPython seeds from urandom/time when no seed is given. The
            // simulators always pass an explicit (possibly null→default)
            // seed; this branch exists only so `new PyRandom()` does not
            // throw. Non-deterministic — never used in parity paths.
            this.seedFromInt(BigInt(Date.now()));
            return;
        }
        this.seedFromInt(typeof seed === 'bigint' ? seed : BigInt(Math.trunc(seed)));
    }

    /** CPython `init_genrand` — seed the state array from a single uint32. */
    private init_genrand(s: number): void {
        const mt = this.mt;
        mt[0] = s >>> 0;
        for (let i = 1; i < N; i += 1) {
            const prev = mt[i - 1] as number;
            mt[i] = (Math.imul(1812433253, (prev ^ (prev >>> 30)) >>> 0) + i) >>> 0;
        }
        this.mti = N;
    }

    /** CPython `init_by_array` — seed the state from an array of uint32 words. */
    private init_by_array(key: number[]): void {
        this.init_genrand(19650218);
        const mt = this.mt;
        const keyLength = key.length;
        let i = 1;
        let j = 0;
        let k = Math.max(N, keyLength);
        for (; k; k -= 1) {
            const prev = mt[i - 1] as number;
            mt[i] =
                (((mt[i] as number) ^ Math.imul((prev ^ (prev >>> 30)) >>> 0, 1664525)) +
                    (key[j] as number) +
                    j) >>>
                0;
            i += 1;
            j += 1;
            if (i >= N) {
                mt[0] = mt[N - 1] as number;
                i = 1;
            }
            if (j >= keyLength) {
                j = 0;
            }
        }
        for (k = N - 1; k; k -= 1) {
            const prev = mt[i - 1] as number;
            mt[i] =
                (((mt[i] as number) ^ Math.imul((prev ^ (prev >>> 30)) >>> 0, 1566083941)) - i) >>> 0;
            i += 1;
            if (i >= N) {
                mt[0] = mt[N - 1] as number;
                i = 1;
            }
        }
        mt[0] = 0x80000000;
    }

    /**
     * Mirror CPython `random_seed` for an integer argument: take `abs(n)`,
     * split into little-endian 32-bit words, and feed `init_by_array`.
     * For seed=0 the key is `[0]`; for seed=1 it is `[1]`.
     */
    private seedFromInt(n: bigint): void {
        let v = n < 0n ? -n : n;
        const key: number[] = [];
        if (v === 0n) {
            key.push(0);
        } else {
            while (v > 0n) {
                key.push(Number(v & 0xffffffffn));
                v >>= 32n;
            }
        }
        this.init_by_array(key);
    }

    /** CPython `genrand_uint32` — one tempered 32-bit output word. */
    private genrand_uint32(): number {
        const mt = this.mt;
        let y: number;
        if (this.mti >= N) {
            let kk: number;
            const mag01 = [0, MATRIX_A];
            for (kk = 0; kk < N - M; kk += 1) {
                y = (((mt[kk] as number) & UPPER_MASK) | ((mt[kk + 1] as number) & LOWER_MASK)) >>> 0;
                mt[kk] = ((mt[kk + M] as number) ^ (y >>> 1) ^ (mag01[y & 0x1] as number)) >>> 0;
            }
            for (; kk < N - 1; kk += 1) {
                y = (((mt[kk] as number) & UPPER_MASK) | ((mt[kk + 1] as number) & LOWER_MASK)) >>> 0;
                mt[kk] = ((mt[kk + (M - N)] as number) ^ (y >>> 1) ^ (mag01[y & 0x1] as number)) >>> 0;
            }
            y = (((mt[N - 1] as number) & UPPER_MASK) | ((mt[0] as number) & LOWER_MASK)) >>> 0;
            mt[N - 1] = ((mt[M - 1] as number) ^ (y >>> 1) ^ (mag01[y & 0x1] as number)) >>> 0;
            this.mti = 0;
        }
        y = mt[this.mti] as number;
        this.mti += 1;
        y ^= y >>> 11;
        y ^= ((y << 7) >>> 0) & 0x9d2c5680;
        y ^= ((y << 15) >>> 0) & 0xefc60000;
        y ^= y >>> 18;
        return y >>> 0;
    }

    /** CPython `random_random` (genrand_res53) — a float in [0, 1). */
    random(): number {
        const a = this.genrand_uint32() >>> 5;
        const b = this.genrand_uint32() >>> 6;
        return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
    }

    /** CPython `getrandbits(k)` — k random bits as a non-negative integer. */
    getrandbits(k: number): number | bigint {
        if (k <= 0) {
            throw new Error('number of bits must be greater than zero');
        }
        if (k <= 32) {
            return this.genrand_uint32() >>> (32 - k);
        }
        // k > 32: assemble LSB-first in 32-bit chunks, as CPython does
        // (each word holds the low `min(32, remaining)` bits).
        let result = 0n;
        let shift = 0n;
        let remaining = k;
        while (remaining > 0) {
            const take = remaining > 32 ? 32 : remaining;
            const word = this.genrand_uint32() >>> (32 - take);
            result |= BigInt(word >>> 0) << shift;
            shift += 32n;
            remaining -= 32;
        }
        return result;
    }

    /** CPython `_randbelow_with_getrandbits` — uniform int in [0, n). */
    _randbelow(n: number): number {
        if (n <= 0) {
            return 0;
        }
        const k = bitLength(n);
        if (k <= 32) {
            let r = this.genrand_uint32() >>> (32 - k);
            while (r >= n) {
                r = this.genrand_uint32() >>> (32 - k);
            }
            return r;
        }
        const bn = BigInt(n);
        let r = this.getrandbits(k) as bigint;
        while (r >= bn) {
            r = this.getrandbits(k) as bigint;
        }
        return Number(r);
    }

    /** CPython `Random.shuffle` — in-place Fisher-Yates using `_randbelow`. */
    shuffle<T>(x: T[]): void {
        for (let i = x.length - 1; i > 0; i -= 1) {
            const j = this._randbelow(i + 1);
            const tmp = x[i] as T;
            x[i] = x[j] as T;
            x[j] = tmp;
        }
    }
}

/** Python `int.bit_length()` for a non-negative integer. */
function bitLength(n: number): number {
    if (n === 0) {
        return 0;
    }
    return Math.abs(n).toString(2).length;
}
