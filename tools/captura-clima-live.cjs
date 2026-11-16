// Legacy command retained for compatibility. Captures use isolated browser mocks;
// this helper never registers accounts or plots in the personal XAMPP database.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const frontend = path.resolve(__dirname, '../frontend-app');
console.log('Capturas de Clima y cultivo con datos representativos de prueba, en claro/oscuro y tres anchos.');
const env = { ...process.env, VITE_API_BASE_URL: 'http://127.0.0.1:5500/backend-api/public/index.php' };
delete env.ZEASYS_E2E_ORIGIN;
const result = spawnSync(process.execPath, [path.join(frontend, 'node_modules/@playwright/test/cli.js'), 'test', 'tests/e2e/climate-ux.spec.js', '--grep', 'Clima claro y sin desbordamiento', '--workers=2'], { cwd: frontend, env, stdio: 'inherit' });
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
