import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiFetch } from '../api/client'; 

export default function ReviewDefinitionPage() {
    const { id: projectId } = useParams();
    const { token } = useAuth();
    const navigate = useNavigate();
    
    const [definitionData, setDefinitionData] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchReviewData() {
            try {
                setLoading(true);
                const defResponse = await apiFetch(`/api/projects/${projectId}/definition`, { token });
                const questionsResponse = await apiFetch(`/api/projects/${projectId}/definition/questions`, { token });
                
                setDefinitionData(defResponse.definition || {});
                setQuestions(questionsResponse.questions || []);
            } catch (err) {
                setError('Error al cargar la información de revisión.');
            } finally {
                setLoading(false);
            }
        }

        if (projectId && token) {
            fetchReviewData();
        }
    }, [projectId, token]);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <p className="text-gray-500 font-medium animate-pulse">Cargando revisión de la definición...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl my-6 text-center shadow-sm">
                {error}
            </div>
        );
    }

    const unresolvedBlockings = Array.isArray(questions) 
        ? questions.filter(q => q.isBlocking && !q.isResolved) 
        : [];

    const sections = definitionData?.sections || {};
    const mvp = definitionData?.mvp || {};

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 animate-fadeIn">
            {/* Cabecera de la sección */}
            <div className="border-b border-gray-200 pb-5">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Revisión de la Definición Inicial
                </h1>
                <p className="text-gray-500 mt-1 text-base">
                    Verifica los datos estructurados del proyecto antes de avanzar a la siguiente etapa.
                </p>
            </div>

            {/* Panel de Preguntas Bloqueantes */}
            {unresolvedBlockings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="bg-amber-100 text-amber-800 p-2 rounded-lg font-bold text-lg">⚠️</div>
                        <div>
                            <h3 className="text-amber-900 font-semibold text-base">Atención: Decisiones bloqueantes pendientes</h3>
                            <p className="text-sm text-amber-700 mt-0.5">
                                Existen {unresolvedBlockings.length} preguntas críticas sin resolver que requieren tu atención.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => navigate(`/proyectos/${projectId}?tab=chat`)}
                        className="whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow transition-colors"
                    >
                        Resolver en el chat
                    </button>
                </div>
            )}

            {/* Cuadrícula Principal de Secciones */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Problema */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                        <h2 className="text-lg font-bold text-gray-800">Problema</h2>
                    </div>
                    <p className={`text-sm leading-relaxed ${sections.problem?.respuesta ? 'text-gray-700 whitespace-pre-line' : 'text-gray-400 italic'}`}>
                        {sections.problem?.respuesta || 'No definido todavía.'}
                    </p>
                </div>

                {/* Contexto */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                        <h2 className="text-lg font-bold text-gray-800">Contexto</h2>
                    </div>
                    <p className={`text-sm leading-relaxed ${sections.context?.respuesta ? 'text-gray-700 whitespace-pre-line' : 'text-gray-400 italic'}`}>
                        {sections.context?.respuesta || 'No definido todavía.'}
                    </p>
                </div>

                {/* Usuarios Objetivo */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                        <h2 className="text-lg font-bold text-gray-800">Usuarios Objetivo</h2>
                    </div>
                    <p className={`text-sm leading-relaxed ${sections.target_users?.respuesta ? 'text-gray-700 whitespace-pre-line' : 'text-gray-400 italic'}`}>
                        {sections.target_users?.respuesta || 'No definido todavía.'}
                    </p>
                </div>

                {/* MVP Funcionalidades */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                        <h2 className="text-lg font-bold text-gray-800">MVP (Funcionalidades)</h2>
                    </div>
                    {mvp.inScope?.length > 0 ? (
                        <ul className="space-y-2 text-sm text-gray-700">
                            {mvp.inScope.map((item, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <span className="text-purple-600 font-bold">•</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-400 italic">No hay funcionalidades dentro del alcance registradas.</p>
                    )}
                </div>

                {/* Recorrido Principal (Ocupa todo el ancho) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 p-6 md:col-span-2 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <h2 className="text-lg font-bold text-gray-800">Recorrido Principal</h2>
                    </div>
                    {mvp.journey?.length > 0 ? (
                        <ol className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 pt-1">
                            {mvp.journey.map((step, index) => (
                                <li key={index} className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm flex gap-3 items-start">
                                    <span className="bg-blue-100 text-blue-700 font-semibold text-xs px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0">
                                        Paso {index + 1}
                                    </span>
                                    <span className="text-gray-700">{step}</span>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="text-sm text-gray-400 italic">No hay pasos de recorrido registrados.</p>
                    )}
                </div>
            </div>
        </div>
    );
}