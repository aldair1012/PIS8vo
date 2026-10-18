import fs from 'fs';
import path from 'path';

// Script casero para mover el build a la raíz para que corra directo en XAMPP.
// La verdad me cansé de copiar y pegar a mano cada vez que hago build, así que
// le pedí ayuda a la IA para hacer esta automatización recursiva que limpia los
// archivos viejos y clona lo nuevo del dist a la raíz. ¡Ahorra muchísimo tiempo!

const srcDir = './dist';
const destDir = '../';

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    // Copia el archivo directamente. Sobreescribe lo que encuentre en la raíz.
    fs.copyFileSync(src, dest);
  }
}

try {
  // Vite puede conservar una copia previa de archivos públicos en algunos
  // entornos de Windows; sincronizamos explícitamente el favicon fuente.
  const faviconSource = './public/favicon.svg';
  if (fs.existsSync(faviconSource)) {
    fs.copyFileSync(faviconSource, path.join(srcDir, 'favicon.svg'));
  }

  // Limpiamos los archivos .js y .css viejos de la carpeta assets en la raíz
  // para que no se acumulen versiones diferentes y rompan cosas.
  const rootAssetsDir = '../assets';
  if (fs.existsSync(rootAssetsDir)) {
    fs.readdirSync(rootAssetsDir).forEach((file) => {
      fs.unlinkSync(path.join(rootAssetsDir, file));
    });
  }

  // Limpiamos los archivos .svg antiguos del directorio raíz (excepto favicon.svg e icons.svg)
  // para que no se queden versiones obsoletas huérfanas en la carpeta de producción.
  const rootDir = '../';
  if (fs.existsSync(rootDir)) {
    fs.readdirSync(rootDir).forEach((file) => {
      if (file.endsWith('.svg') && file !== 'favicon.svg' && file !== 'icons.svg') {
        fs.unlinkSync(path.join(rootDir, file));
      }
    });
  }

  // Copiamos el nuevo build
  copyRecursiveSync(srcDir, destDir);
  console.log('¡Éxito! El build ha sido copiado a la raíz correctamente para XAMPP.');
} catch (err) {
  console.error('Error al copiar el build a la raíz:', err);
}
