// Runs the economics and core tests in Node, with no browser:
//   node tools/econ-graph/tests/run.js
// Exits non-zero if anything fails.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, '..', 'econ-graph-generator.html'), 'utf8');
const typeFiles = [...html.matchAll(/src="econ-graph\/(types\/[^"]+\.js)"/g)].map(m => m[1]);

const context = vm.createContext({ console });
['engine.js', 'registry.js', ...typeFiles, 'tests/core-tests.js'].forEach(file => {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
});

const results = vm.runInContext('[...runCoreTests(), ...GraphTypes.runEconTests()]', context);
const failed = results.filter(r => r.failures.length);
results.forEach(r => console.log(`${r.failures.length ? 'FAIL' : 'ok  '} ${r.type}: ${r.name}`));
failed.forEach(r => r.failures.forEach(f => console.log(`  ${r.type}: ${r.name}: ${f}`)));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
