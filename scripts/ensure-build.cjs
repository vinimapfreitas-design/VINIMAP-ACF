// scripts/ensure-build.cjs
// Garante que o build de produção (dist/) está íntegro antes de subir o servidor.
// Reconstroi quando:
//  1) O bundle JS principal referenciado por dist/index.html não existe no disco
//     (corrige builds parciais que derrubam a aplicação: index.html novo + bundle ausente).
//  2) O código-fonte (server.ts) é mais novo que o dist/server.cjs compilado,
//     garantindo que o servidor sempre rode a versão mais recente do backend
//     (ex.: o bloco de auto-deploy restaurado).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const indexPath = path.join(root, 'dist', 'index.html');

function mainBundleMissing() {
  if (!fs.existsSync(indexPath)) return true;
  const html = fs.readFileSync(indexPath, 'utf-8');
  // Captura o bundle de entrada do Vite: <script type="module" ... src="/assets/index-XXXX.js">
  const match = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/);
  if (!match) return true;
  const bundlePath = path.join(root, 'dist', match[1].replace(/^\//, ''));
  return !fs.existsSync(bundlePath);
}

function serverSourceNewerThanBuild() {
  const srcServer = path.join(root, 'server.ts');
  const builtServer = path.join(root, 'dist', 'server.cjs');
  if (!fs.existsSync(srcServer) || !fs.existsSync(builtServer)) return true;
  return fs.statSync(srcServer).mtimeMs > fs.statSync(builtServer).mtimeMs;
}

const needsRebuild = mainBundleMissing() || serverSourceNewerThanBuild();

if (needsRebuild) {
  console.log('[ensure-build] dist desatualizado ou incompleto. Executando npm run build...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('[ensure-build] Build concluído com sucesso. Iniciando servidor...');
} else {
  console.log('[ensure-build] dist íntegro. Iniciando servidor...');
}
