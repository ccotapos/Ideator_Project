// Provisiona los secretos de Ideator en Azure Key Vault a partir de los valores
// de .env. Es idempotente: setSecret crea una nueva versión si ya existe.
//
// Uso:
//   node scripts/keyvault-bootstrap.js
//
// Requiere AZURE_KEY_VAULT_URL (o KEY_VAULT_NAME) y credenciales válidas:
//   - Managed Identity en Azure, o
//   - AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET en local.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');
const { getVaultUrl, SECRET_MAP } = require('../src/config/keyVault');

async function main() {
  const vaultUrl = getVaultUrl();
  if (!vaultUrl) {
    throw new Error('Configura AZURE_KEY_VAULT_URL o KEY_VAULT_NAME en .env.');
  }

  console.log(`Provisionando secretos en ${vaultUrl} ...`);
  const client = new SecretClient(vaultUrl, new DefaultAzureCredential());

  const provisioned = [];
  const skipped = [];

  for (const [envName, secretName] of Object.entries(SECRET_MAP)) {
    const value = process.env[envName];

    if (!value || !String(value).trim()) {
      skipped.push(envName);
      console.warn(` - Omitido ${secretName}: ${envName} está vacío en .env`);
      continue;
    }

    await client.setSecret(secretName, String(value));
    const check = await client.getSecret(secretName);
    if (!check?.value) throw new Error(`No se pudo verificar el secreto ${secretName}.`);

    provisioned.push(`${secretName} -> ${envName}`);
    console.log(` - OK ${secretName} -> ${envName}`);
  }

  console.log('');
  console.log(`Secretos provisionados: ${provisioned.length}`);
  if (skipped.length > 0) {
    console.log(`Variables omitidas por estar vacías: ${skipped.join(', ')}`);
  }
  console.log('Ahora puedes activar AZURE_KEY_VAULT_URL en .env y recrear el backend.');
}

main().catch((error) => {
  console.error('Error al provisionar Key Vault:', error.message);
  process.exit(1);
});
