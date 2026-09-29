import { z } from 'zod';

// Zod probes `new Function` to pick its JIT parser; the CSP forbids eval and logs a violation.
z.config({ jitless: true });
