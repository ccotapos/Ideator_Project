const dateFormatter = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });

export function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : timeFormatter.format(date);
}