// Regex simple y suficiente para validar formato de email en el cliente.
// La validación definitiva siempre ocurre en el backend.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Valida el formulario de login.
 * Devuelve un objeto { campo: mensaje } solo con los campos que fallaron.
 */
export function validateLoginForm({ email, password }) {
  const errors = {};

  if (!email.trim()) {
    errors.email = 'El correo electrónico es obligatorio.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Ingresa un correo electrónico válido.';
  }

  if (!password) {
    errors.password = 'La contraseña es obligatoria.';
  }

  return errors;
}

/**
 * Valida el formulario de registro.
 */
export function validateRegisterForm({ name, email, password, confirmPassword }) {
  const errors = {};

  if (!name.trim()) {
    errors.name = 'El nombre es obligatorio.';
  }

  if (!email.trim()) {
    errors.email = 'El correo electrónico es obligatorio.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Ingresa un correo electrónico válido.';
  }

  if (!password) {
    errors.password = 'La contraseña es obligatoria.';
  } else if (password.length < 6) {
    errors.password = 'La contraseña debe tener al menos 6 caracteres.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirma tu contraseña.';
  } else if (password && confirmPassword !== password) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }

  return errors;
}
