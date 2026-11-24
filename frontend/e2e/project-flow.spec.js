import { expect, test } from '@playwright/test';

test('usuario se registra, inicia sesión y crea un proyecto privado', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `e2e-${suffix}@example.com`;
  const password = 'PruebaSegura123!';
  const projectName = `Proyecto municipal ${suffix}`;

  await page.goto('/register');
  await page.getByLabel('Nombre completo').fill('Prueba Funcional');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirmar contraseña').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Cuenta creada correctamente')).toBeVisible();
  await page.waitForURL('**/login');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Ideator' })).toBeVisible();

  await page.getByRole('link', { name: 'Proyectos', exact: true }).click();
  await page.getByRole('button', { name: '+ Nuevo proyecto' }).click();
  await page.getByLabel('Nombre del proyecto').fill(projectName);
  await page.getByLabel('Descripción (opcional)').fill('Seguimiento de luminarias dañadas en Peñalolén.');
  await page.getByRole('button', { name: 'Crear proyecto' }).click();

  await expect(page.getByRole('heading', { name: projectName })).toBeVisible();
  await page.getByRole('heading', { name: projectName }).click();
  await expect(page.getByText('Owner', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisión Inicial' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Documentos finales' })).toBeVisible();
});
