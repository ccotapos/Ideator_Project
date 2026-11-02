// Script de administración de secretos en Azure Key Vault.
// NO se ejecuta al arrancar el servidor: úsalo manualmente para crear, leer,
// actualizar o borrar secretos.
//
// Uso:
//   node scripts/keyvault-secrets.js set    <nombre> <valor>
//   node scripts/keyvault-secrets.js get    <nombre>
//   node scripts/keyvault-secrets.js update <nombre> <enabled|disabled>
//   node scripts/keyvault-secrets.js delete <nombre>
//
// Requiere AZURE_KEY_VAULT_URL (o KEY_VAULT_NAME) y credenciales válidas
// (Managed Identity en Azure o service principal en local).
const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');

function getVaultUrl() {
  if (process.env.AZURE_KEY_VAULT_URL) return process.env.AZURE_KEY_VAULT_URL;
  if (process.env.KEY_VAULT_NAME) return `https://${process.env.KEY_VAULT_NAME}.vault.azure.net`;
  throw new Error('Configura AZURE_KEY_VAULT_URL o KEY_VAULT_NAME.');
}

function usage() {
  console.log('Uso: node scripts/keyvault-secrets.js <set|get|update|delete> <nombre> [valor]');
}

async function main() {
  const [command, secretName, value] = process.argv.slice(2);

  if (!command || !secretName) {
    usage();
    process.exit(1);
  }

  const client = new SecretClient(getVaultUrl(), new DefaultAzureCredential());

  if (command === 'set') {
    if (!value) throw new Error('Falta el valor del secreto.');
    const result = await client.setSecret(secretName, value);
    console.log(`Secreto "${secretName}" creado/actualizado (versión ${result.properties.version}).`);
    return;
  }

  if (command === 'get') {
    const secret = await client.getSecret(secretName);
    console.log(`Secreto "${secretName}" (versión ${secret.properties.version}):`);
    console.log(secret.value);
    return;
  }

  if (command === 'update') {
    const secret = await client.getSecret(secretName);
    const enabled = value !== 'disabled';
    const updated = await client.updateSecretProperties(secretName, secret.properties.version, { enabled });
    console.log(`Secreto "${secretName}" actualizado. enabled=${updated.enabled}`);
    return;
  }

  if (command === 'delete') {
    await client.beginDeleteSecret(secretName);
    console.log(`Secreto "${secretName}" marcado para borrado.`);
    return;
  }

  usage();
  process.exit(1);
}

main().catch((error) => {
  console.error('Error de Key Vault:', error.message);
  process.exit(1);
});
