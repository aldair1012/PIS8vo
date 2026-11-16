// Espera a que el espacio de trabajo autenticado monte en el DOM antes de interactuar
// y descarta el modal de bienvenida si aparece (la ZeaSys actual lo muestra en cada
// primera autenticación; en tests cada navegador es fresco, así que hay que cerrarlo
// para que no intercepte los clics posteriores).
export async function waitForWorkspace(page) {
  await page.waitForSelector('#workspace-sidebar', { state: 'attached', timeout: 30000 });
  const primario = page.locator('.consejo-modal-primary');
  try {
    await primario.waitFor({ state: 'visible', timeout: 8000 });
    await primario.click();
  } catch {
    // El consejo ya estaba cerrado (localStorage) o no llegó a renderizar.
  }
}
