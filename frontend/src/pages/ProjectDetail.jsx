import { useParams } from 'react-router-dom';
import { ProjectMembers } from '../components/ProjectMembers';

export default function ProjectDetail() {
  const { id } = useParams();

  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="panel-kicker">Proyecto #{id}</p>
        <h2>Invitar colaboradores</h2>
      </div>
      <ProjectMembers projectId={id} />
    </section>
  );
}
