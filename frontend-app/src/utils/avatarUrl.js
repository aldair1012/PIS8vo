// Las rutas guardadas son relativas al backend; la web puede vivir en /ZeaSys.
export function avatarUrl(value, apiBaseUrl) {
  if (typeof value !== 'string' || !value.startsWith('/backend-api/public/uploads/avatars/')) return value;
  const relative = value.slice('/backend-api/public/'.length);
  return `${apiBaseUrl.replace(/\/index\.php\/?$/, '')}/${relative}`;
}
