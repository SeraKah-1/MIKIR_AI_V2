import { useState, useEffect, useRef } from 'react';
import { getSupabaseConfig } from '../services/storageService';
import { MikirCloud } from '../services/supabaseService';
import { useAppStore } from '../store/useAppStore';

export const useMultiplayerSync = (setCurrentIndex: (index: number) => void) => {
  const { isMultiplayer, multiplayerRoomId: roomId } = useAppStore();
  const [multiplayerScores, setMultiplayerScores] = useState<any[]>([]);
  const scoresRef = useRef<any[]>([]);

  // Fetch and subscribe to multiplayer scores
  useEffect(() => {
    if (!isMultiplayer || !roomId) return;

    const fetchScores = async () => {
      try {
        const config = getSupabaseConfig();
        if (!config) return;
        const data = await MikirCloud.multiplayer.getLeaderboard(config, roomId);
        setMultiplayerScores(data);
        scoresRef.current = data;
      } catch (err) {
        console.error("Failed to fetch multiplayer scores", err);
      }
    };

    fetchScores();

    const config = getSupabaseConfig();
    if (config) {
      const sb = MikirCloud._client(config);
      const channel = sb.channel(`leaderboard:${roomId}`);
      
      channel
        .on('broadcast', { event: 'score_update' }, (payload) => {
          const { playerId, isCorrect, scoreDelta } = payload.payload;
          if (isCorrect && scoreDelta > 0) {
            const currentScores = [...scoresRef.current];
            const playerIndex = currentScores.findIndex(p => p.id === playerId);
            if (playerIndex !== -1) {
              currentScores[playerIndex] = {
                ...currentScores[playerIndex],
                score: currentScores[playerIndex].score + scoreDelta
              };
              currentScores.sort((a, b) => b.score - a.score);
              scoresRef.current = currentScores;
              setMultiplayerScores(currentScores);
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, () => {
          fetchScores();
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [isMultiplayer, roomId]);

  // Subscribe to Room Status (Question Index)
  useEffect(() => {
    if (!isMultiplayer || !roomId) return;

    const config = getSupabaseConfig();
    if (config) {
      const subscription = MikirCloud.multiplayer.subscribeToRoom(config, roomId, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new.current_question_index !== undefined) {
          setCurrentIndex(payload.new.current_question_index);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isMultiplayer, roomId, setCurrentIndex]);

  return { multiplayerScores };
};
