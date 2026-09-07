import React from 'react';
import { useParams } from 'react-router-dom';
import { ProjectMembers } from '../components/ProjectMembers';

export const ProjectDetail = () => {
  const { id } = useParams(); // Asumiendo uso de react-router-dom

  return (
    <div>
      <h1>Detalle del Proyecto #{id}</h1>
      <ProjectMembers projectId={id} />
    </div>
  );
};