const { Issuer } = require('openid-client');

let ssoClientPromise = null;

// Descubre la configuración del proveedor OIDC (Google, Okta, Auth0, o un
// mock de pruebas) y construye el cliente una sola vez, reutilizándolo.
function getSsoClient() {
  if (!ssoClientPromise) {
    const issuerUrl = process.env.SSO_ISSUER_URL;

    if (!issuerUrl) {
      throw new Error('SSO_ISSUER_URL no está configurada.');
    }

    ssoClientPromise = Issuer.discover(issuerUrl).then((issuer) => {
      return new issuer.Client({
        client_id: process.env.SSO_CLIENT_ID,
        client_secret: process.env.SSO_CLIENT_SECRET,
        redirect_uris: [process.env.SSO_REDIRECT_URI],
        response_types: ['code'],
      });
    });
  }

  return ssoClientPromise;
}

module.exports = { getSsoClient };