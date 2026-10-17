import { z } from 'zod'

// zod's JIT probes for eval(), which our Content-Security-Policy forbids; validate without it.
// This module must be imported before anything that builds a schema, hence the first import in main.tsx.
z.config({ jitless: true })
