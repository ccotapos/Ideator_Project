// Carga secretos desde Azure Key Vault y los inyecta en process.env ANTES de
// que se importen config/db y las rutas. Si no hay vault configurado, no hace
// nada y la aplicación sigue usando .env.
const SECRET_MAP = {
  DB_PASSWORD: 'db-password',
  JWT_SECRET: 'jwt-secret',
  SSO_CLIENT_SECRET: 'sso-client-secret',
  GEMINI_API_KEY: 'gemini-api-key',
  FOUNDRY_API_KEY: 'foundry-api-key',
};

function getVaultUrl() {
  if (process.env.AZURE_KEY_VAULT_URL) return process.env.AZURE_KEY_VAULT_URL;
  if (process.env.KEY_VAULT_NAME) return `https://${process.env.KEY_VAULT_NAME}.vault.azure.net`;
  return null;
}

async function loadSecrets({ logger = console } = {}) {
  const vaultUrl = getVaultUrl();
  if (!vaultUrl) return { enabled: false, loaded: [], missing: [] };

  let client;
  try {
    const { SecretClient } = require('@azure/keyvault-secrets');
    const { DefaultAzureCredential } = require('@azure/identity');
    client = new SecretClient(vaultUrl, new DefaultAzureCredential());
  } catch (error) {
    logger.warn(`Key Vault: no se pudo inicializar el cliente (${error.message}); se usará .env.`);
    return { enabled: false, loaded: [], missing: [] };
  }

  const loaded = [];
  const missing = [];

  for (const [envName, secretName] of Object.entries(SECRET_MAP)) {
    try {
      const secret = await client.getSecret(secretName);
      if (!secret?.value) throw new Error('el secreto está vacío');
      process.env[envName] = secret.value;
      loaded.push(envName);
      logger.log(`Key Vault: ${secretName} -> ${envName}`);
    } catch (error) {
      missing.push(envName);
      logger.warn(`Key Vault: no se pudo leer ${secretName} (${error.message}); se usará .env para ${envName}.`);
    }
  }

  return { enabled: true, loaded, missing };
}

module.exports = { loadSecrets, getVaultUrl, SECRET_MAP };
