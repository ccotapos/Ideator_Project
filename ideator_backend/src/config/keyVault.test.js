jest.mock('@azure/keyvault-secrets', () => ({ SecretClient: jest.fn() }));
jest.mock('@azure/identity', () => ({ DefaultAzureCredential: jest.fn() }));

const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');
const { loadSecrets, getVaultUrl } = require('./keyVault');

describe('Azure Key Vault', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  test('no hace nada si no hay URL ni nombre de vault', async () => {
    delete process.env.AZURE_KEY_VAULT_URL;
    delete process.env.KEY_VAULT_NAME;

    const logger = { log: jest.fn(), warn: jest.fn() };
    const result = await loadSecrets({ logger });

    expect(result.enabled).toBe(false);
    expect(SecretClient).not.toHaveBeenCalled();
  });

  test('construye la URL desde KEY_VAULT_NAME', () => {
    delete process.env.AZURE_KEY_VAULT_URL;
    process.env.KEY_VAULT_NAME = 'papulinces';

    expect(getVaultUrl()).toBe('https://papulinces.vault.azure.net');
  });

  test('carga los secretos y los inyecta en process.env', async () => {
    process.env.AZURE_KEY_VAULT_URL = 'https://papulinces.vault.azure.net';
    delete process.env.DB_PASSWORD;

    const getSecret = jest.fn(async (name) => ({ value: `value-${name}` }));
    SecretClient.mockImplementation(() => ({ getSecret }));
    DefaultAzureCredential.mockImplementation(() => ({}));

    const logger = { log: jest.fn(), warn: jest.fn() };
    const result = await loadSecrets({ logger });

    expect(result.enabled).toBe(true);
    expect(process.env.DB_PASSWORD).toBe('value-db-password');
    expect(process.env.JWT_SECRET).toBe('value-jwt-secret');
    expect(getSecret).toHaveBeenCalledWith('db-password');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('avisa y continúa si un secreto falta', async () => {
    process.env.AZURE_KEY_VAULT_URL = 'https://papulinces.vault.azure.net';
    delete process.env.DB_PASSWORD;

    const getSecret = jest.fn(async (name) => {
      if (name === 'db-password') throw new Error('secret not found');
      return { value: `value-${name}` };
    });
    SecretClient.mockImplementation(() => ({ getSecret }));
    DefaultAzureCredential.mockImplementation(() => ({}));

    const logger = { log: jest.fn(), warn: jest.fn() };
    const result = await loadSecrets({ logger });

    expect(result.enabled).toBe(true);
    expect(result.missing).toContain('DB_PASSWORD');
    expect(logger.warn).toHaveBeenCalled();
  });

  test('no rompe si el cliente de Azure no se puede inicializar', async () => {
    process.env.AZURE_KEY_VAULT_URL = 'https://papulinces.vault.azure.net';
    SecretClient.mockImplementation(() => {
      throw new Error('no credentials');
    });

    const logger = { log: jest.fn(), warn: jest.fn() };
    const result = await loadSecrets({ logger });

    expect(result.enabled).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });
});
