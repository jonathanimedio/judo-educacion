import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Inicialización de cliente Supabase utilizando variables de entorno de Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ActivityItem {
  id: string;
  activity_type: string;
  payload: {
    title?: string;
    resource_id?: string;
  };
  created_at: string;
  user: {
    full_name: string;
    username: string;
    avatar_url: string;
    club: string;
  };
}

export const CommunityFeed: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchCommunityActivity();

    // Suscripción en tiempo real a nuevas actividades de la comunidad
    const subscription = supabase
      .channel('public:community_activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_activity' }, 
        async (payload) => {
          // Consultar los datos completos del usuario autor de la nueva actividad
          const { data: userData } = await supabase
            .from('profiles')
            .select('full_name, username, avatar_url, club')
            .eq('id', payload.new.user_id)
            .single();

          if (userData) {
            const newEntry: ActivityItem = {
              id: payload.new.id,
              activity_type: payload.new.activity_type,
              payload: payload.new.payload,
              created_at: payload.new.created_at,
              user: userData
            };
            setActivities((prev) => [newEntry, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchCommunityActivity = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('community_activity')
        .select(`
          id,
          activity_type,
          payload,
          created_at,
          user:profiles(full_name, username, avatar_url, club)
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;
      if (data) setActivities(data as unknown as ActivityItem[]);
    } catch (err) {
      console.error('Error al cargar la actividad de la comunidad:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderActivityText = (item: ActivityItem) => {
    switch (item.activity_type) {
      case 'publish_resource':
        return <>ha publicado un nuevo recurso: <strong className="text-blue-900 font-semibold">{item.payload.title || 'Sin título'}</strong></>;
      case 'badge_earned':
        return <>ha desbloqueado una nueva insignia en su camino como maestro.</>;
      default:
        return <>ha realizado una contribución en la comunidad.</>;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>👥</span> Actividad de la Comunidad
          </h2>
          <p className="text-sm text-slate-600">Lo que está pasando ahora mismo entre maestros de judo</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando pulso de la comunidad...</div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-slate-600">Todavía no hay actividad registrada. ¡Sé el primero en compartir un recurso!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-3 transition hover:shadow-md">
              <img 
                src={item.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} 
                alt={item.user?.full_name} 
                className="w-10 h-10 rounded-full object-cover border border-slate-200"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{item.user?.full_name || 'Maestro Anónimo'}</span>
                  <span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-0.5 mb-1 font-medium">
                  {item.user?.club || 'Club de Judo'}
                </span>
                <p className="text-sm text-slate-700 mt-1">
                  {renderActivityText(item)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
