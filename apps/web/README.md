# Web client checks

Run the React production build and the independent web unit tests from this directory:

```sh
npm ci
npm run build
npm test
npm run test:coverage
```

Vitest produces V8 coverage reports in `coverage/` (text, LCOV, and JSON summary).
The initial full-source baseline is 1.78% line coverage. CI currently protects the
two exercised surfaces (`api.ts` and `ui.tsx`) with per-file floors set just below
their measured baseline. There is no whole-application percentage gate yet because
the broader UI has not been covered sufficiently to justify one.
