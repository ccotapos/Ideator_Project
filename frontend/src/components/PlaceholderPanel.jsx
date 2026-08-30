export default function PlaceholderPanel({ title, description }) {
  return (
    <article className="placeholder-panel">
      <p className="panel-kicker">Placeholder</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </article>
  );
}