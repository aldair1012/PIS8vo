import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarUrl } from './avatarUrl.js';

test('la foto local conserva el prefijo de despliegue y las externas no se reescriben', () => {
  const path = '/backend-api/public/uploads/avatars/avatar_7_123.png';
  assert.equal(avatarUrl(path, 'http://localhost/ZeaSys/backend-api/public/index.php'), 'http://localhost/ZeaSys/backend-api/public/uploads/avatars/avatar_7_123.png');
  assert.equal(avatarUrl(path, 'http://127.0.0.1:5500/backend-api/public/index.php'), 'http://127.0.0.1:5500/backend-api/public/uploads/avatars/avatar_7_123.png');
  assert.equal(avatarUrl('https://lh3.googleusercontent.com/photo', 'http://localhost/ZeaSys/backend-api/public/index.php'), 'https://lh3.googleusercontent.com/photo');
  assert.equal(avatarUrl(null, 'http://localhost/ZeaSys/backend-api/public/index.php'), null);
});
