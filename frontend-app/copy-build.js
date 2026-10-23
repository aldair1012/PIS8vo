import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Resolve paths independently of the shell's working directory.
const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(frontendDir, 'dist');
const projectDir = path.dirname(frontendDir);
const assetsDir = path.join(projectDir, 'assets');
const manifestPath = path.join(assetsDir, 'zeasys-build-manifest.json');
const generatedName = /^(?:app|estilo|iconos|http|react|graficos|mapas|modelo-3d|terceros|rolldown-runtime|logo-full|logo-icon|yield|climate-soil|field-decisions|maize-hero)-[\w-]+\.(?:js|css|svg|jpg|png)$/;

function assetPath(name) {
  if (typeof name !== 'string' || path.basename(name) !== name) {
    throw new Error('Invalid generated asset name.');
  }
  const resolved = path.resolve(assetsDir, name);
  if (path.dirname(resolved) !== assetsDir) {
    throw new Error('Generated asset is outside the deployment assets directory.');
  }
  return resolved;
}

function copyBuild(source, destination) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    // Replace the entry point only after its resources are installed.
    if (source === sourceDir && entry.name === 'index.html') continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Build must not contain symbolic links.');
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyBuild(from, to);
    } else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

try {
  if (!fs.existsSync(path.join(sourceDir, 'index.html'))) {
    throw new Error('No build found. Run Vite before copying the deployment.');
  }
  fs.mkdirSync(assetsDir, { recursive: true });
  const currentAssets = fs.readdirSync(path.join(sourceDir, 'assets'))
    .filter(name => fs.lstatSync(path.join(sourceDir, 'assets', name)).isFile());
  // On the first run, recognize only known Vite names. Keep unrelated files.
  const previousAssets = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : fs.readdirSync(assetsDir).filter(name => generatedName.test(name));
  if (!Array.isArray(previousAssets)) throw new Error('Invalid deployment asset manifest.');
  previousAssets.forEach(assetPath);

  copyBuild(sourceDir, projectDir);
  fs.copyFileSync(path.join(sourceDir, 'index.html'), path.join(projectDir, 'index.html'));
  let removed = 0;
  for (const name of previousAssets) {
    const target = assetPath(name);
    if (!currentAssets.includes(name) && fs.existsSync(target) && fs.lstatSync(target).isFile()) {
      fs.unlinkSync(target);
      removed++;
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(currentAssets, null, 2) + '\n');
  console.log(`Build copiado a XAMPP. ${removed} recursos generados obsoletos retirados.`);
} catch (error) {
  console.error('Error al copiar el build:', error);
  process.exitCode = 1;
}
