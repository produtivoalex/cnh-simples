// CNH Simples - Sync Engine (Instant ID-Only Cloud Sync + Portable Payload Fallback)

(function () {
  'use strict';

  // Cloud Topic Prefix for Zero-Config ID Sync
  const TOPIC_PREFIX = 'cnh_simples_sync_';

  const sync = {
    // Generate an easy 4-character driver alphanumeric code like "CNH-6L7Y"
    generateUserCode() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = 'CNH-';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    },

    getUserCode() {
      let code = localStorage.getItem('cnh_user_code');
      if (!code) {
        code = this.generateUserCode();
        localStorage.setItem('cnh_user_code', code);
      }
      return code.trim().toUpperCase();
    },

    setUserCode(newCode) {
      if (!newCode || newCode.trim().length < 4) return false;
      const clean = newCode.trim().toUpperCase();
      localStorage.setItem('cnh_user_code', clean);
      return true;
    },

    getCloudTopic(code) {
      const clean = (code || this.getUserCode()).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return `${TOPIC_PREFIX}${clean}`;
    },

    // Collect current local progress
    getLocalPayload() {
      return {
        code: this.getUserCode(),
        stats: JSON.parse(localStorage.getItem('cnh_stats_v4') || localStorage.getItem('cnh_stats_v3') || '{}'),
        difficulty: JSON.parse(localStorage.getItem('cnh_user_difficulty_v4') || localStorage.getItem('cnh_user_difficulty_v3') || '{}'),
        achievements: JSON.parse(localStorage.getItem('cnh_achievements_v4') || localStorage.getItem('cnh_achievements_v3') || '[]'),
        mastered: JSON.parse(localStorage.getItem('cnh_mastered_qs_v4') || '[]'),
        timestamp: Date.now()
      };
    },

    // Apply data directly to localStorage if newer or valid
    applyPayload(data) {
      if (!data || !data.stats) return false;
      if (data.code) localStorage.setItem('cnh_user_code', data.code);
      if (data.stats) localStorage.setItem('cnh_stats_v4', JSON.stringify(data.stats));
      if (data.difficulty) localStorage.setItem('cnh_user_difficulty_v4', JSON.stringify(data.difficulty));
      if (data.achievements) localStorage.setItem('cnh_achievements_v4', JSON.stringify(data.achievements));
      if (data.mastered) localStorage.setItem('cnh_mastered_qs_v4', JSON.stringify(data.mastered));
      if (data.timestamp) localStorage.setItem('cnh_last_sync_ts', String(data.timestamp));
      return true;
    },

    // 1. PUSH PROGRESS TO CLOUD USING JUST DRIVER ID (Auto-sync imediato e sem ruído)
    async pushToCloud(customCode = null) {
      const code = customCode || this.getUserCode();
      const topic = this.getCloudTopic(code);
      const payload = this.getLocalPayload();
      payload.code = code;
      payload.timestamp = Date.now();

      try {
        const resp = await fetch(`https://ntfy.sh/${topic}`, {
          method: 'POST',
          headers: {
            'Title': `Progresso CNH Simples ${code}`,
            'Tags': 'car,white_check_mark'
          },
          body: JSON.stringify(payload)
        });
        if (resp.ok) {
          localStorage.setItem('cnh_last_sync_ts', String(payload.timestamp));
        }
        return resp.ok;
      } catch (e) {
        console.warn('Sync push error:', e);
        return false;
      }
    },

    // 2. PULL PROGRESS FROM CLOUD USING JUST DRIVER ID
    async pullFromCloud(targetCode, silentIfEqual = false) {
      if (!targetCode) return { success: false, error: 'Código não informado' };
      const code = targetCode.trim().toUpperCase();
      const topic = this.getCloudTopic(code);

      try {
        const resp = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=all`);
        if (!resp.ok) return { success: false, error: 'Falha ao conectar à nuvem' };

        const text = await resp.text();
        const lines = text.trim().split('\n').filter(Boolean);
        if (lines.length === 0) {
          return { success: false, error: `Nenhum progresso encontrado na nuvem para o ID ${code}.` };
        }

        // Get the latest message from cloud
        const lastMsg = JSON.parse(lines[lines.length - 1]);
        const payload = typeof lastMsg.message === 'string' ? JSON.parse(lastMsg.message) : lastMsg.message;

        if (payload && payload.stats) {
          const localTs = parseInt(localStorage.getItem('cnh_last_sync_ts') || '0', 10);
          const cloudTs = payload.timestamp || 0;

          // Se a nuvem tiver dados mais novos ou com mais questões respondidas, atualiza
          const localTotal = JSON.parse(localStorage.getItem('cnh_stats_v4') || '{}').totalAnswered || 0;
          const cloudTotal = payload.stats.totalAnswered || 0;

          if (cloudTs > localTs || cloudTotal > localTotal) {
            this.applyPayload(payload);
            return { success: true, updated: true, payload };
          }
          return { success: true, updated: false, payload };
        }
        return { success: false, error: 'Formato de progresso corrompido' };
      } catch (e) {
        console.error('Sync pull error:', e);
        return { success: false, error: e.message || 'Erro de comunicação' };
      }
    },

    // 3. AUTO-SYNC BIDIRECIONAL AO INICIAR / FOCAR O APP
    async autoCheckSync(onUpdateCallback) {
      const code = this.getUserCode();
      if (!code) return;

      try {
        const res = await this.pullFromCloud(code, true);
        if (res.success && res.updated) {
          if (typeof onUpdateCallback === 'function') {
            onUpdateCallback(res.payload);
          }
        }
      } catch (e) {}
    },

    // Portable string export fallback
    exportProgressPayload() {
      const payload = this.getLocalPayload();
      return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    },

    // Portable string import fallback
    importProgressPayload(encodedStr) {
      try {
        const jsonStr = decodeURIComponent(escape(atob(encodedStr.trim())));
        const data = JSON.parse(jsonStr);
        return this.applyPayload(data);
      } catch (e) {
        console.error('Import error:', e);
        return false;
      }
    }
  };

  window.cnhSync = sync;
})();

