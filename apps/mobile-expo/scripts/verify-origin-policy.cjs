const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../src/api.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
const compiled = new Module(sourcePath, module);
compiled.filename = sourcePath;
compiled.paths = Module._nodeModulePaths(path.dirname(sourcePath));
const requireAtRuntime = compiled.require.bind(compiled);
compiled.require = (specifier) => specifier === './calendar' ? {} : requireAtRuntime(specifier);
compiled._compile(output, sourcePath);

const {normalizeOrigin} = compiled.exports;
const originalFlag = process.env.EXPO_PUBLIC_SRD_QA_ONLY;

function mustReject(value, allowLocalHttp = false) {
  assert.throws(() => normalizeOrigin(value, allowLocalHttp), Error, `${value} must be rejected`);
}

try {
  process.env.EXPO_PUBLIC_SRD_QA_ONLY = '1';
  assert.equal(normalizeOrigin('http://10.0.2.2:8080', false), 'http://10.0.2.2:8080');
  assert.equal(normalizeOrigin('http://localhost:8080', false), 'http://localhost:8080');
  mustReject('http://example.com');
  mustReject('https://example.com');
  mustReject('https://example.com/path');

  delete process.env.EXPO_PUBLIC_SRD_QA_ONLY;
  mustReject('http://10.0.2.2:8080');
  assert.equal(normalizeOrigin('http://10.0.2.2:8080', true), 'http://10.0.2.2:8080');
  assert.equal(normalizeOrigin('https://srd.example.org', false), 'https://srd.example.org');
  console.log('PASS: QA permits HTTP only to local hosts; normal builds require HTTPS.');
} finally {
  if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_SRD_QA_ONLY;
  else process.env.EXPO_PUBLIC_SRD_QA_ONLY = originalFlag;
}
