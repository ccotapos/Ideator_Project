const STEPS = [
  {
    number: '01',
    title: 'Ideación',
    description: 'Alineen problema, personas y alcance.',
  },
  {
    number: '02',
    title: 'Arquitectura',
    description: 'Conviertan acuerdos en decisiones técnicas.',
  },
  {
    number: '03',
    title: 'Creación',
    description: 'Preparen un prototipo listo para validar.',
  },
];

export default function AuthPromoPanel() {
  return (
    <aside className="auth-promo">
      <div className="auth-promo-logo">
        <div className="auth-promo-logo-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2Z"
              stroke="#1b2f8f"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M9.5 21h5" stroke="#1b2f8f" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M12 6.5v4" stroke="#1b2f8f" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <span>Ideator</span>
      </div>

      <p className="auth-promo-badge">Ideator · Collaborative Workspace</p>

      <h1>Las mejores ideas no avanzan solas.</h1>

      <p className="auth-promo-lead">
        Conversa, consolida decisiones y avanza únicamente cuando todo el equipo esté de acuerdo.
      </p>

      <div className="auth-promo-steps">
        {STEPS.map((step) => (
          <div className="auth-promo-step" key={step.number}>
            <span className="auth-promo-step-number">{step.number}</span>
            <div>
              <p className="auth-promo-step-title">{step.title}</p>
              <p className="auth-promo-step-desc">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}