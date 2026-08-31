export default function PlaceholderPanel({ title, description }) {
  return (
    <article className="placeholder-panel">
      <p className="panel-kicker">Panel Inicial</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  );
}