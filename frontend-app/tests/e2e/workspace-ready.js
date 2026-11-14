// Espera a que el espacio de trabajo autenticado monte en el DOM antes de interactuar.
// El render de la app es asíncrono (auth + chunks diferidos); sin esta espera los
// botones de la barra lateral pueden no existir todavía.
export async function waitForWorkspace(page) {
  await page.waitForSelector('#workspace-sidebar', { state: 'attached', timeout: 30000 });
}
