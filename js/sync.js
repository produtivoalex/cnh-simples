// CNH Simples - Sync Engine (Universal Cross-Device Progress: Sync Code + Local Cloud Sync)

(function () {
  'use strict';

  const SYNC_SERVER_URL = 'https://api.jsonbin.io/v3/b'; // Or generic lightweight cloud state

  const sync = {
    // Generate an easy 6-digit or short alphanumeric code like "CNH-7492"
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
      return code;
    },

    setUserCode(newCode) {
      if (!newCode || newCode.trim().length < 4) return false;
      const clean = newCode.trim().toUpperCase();
      localStorage.setItem('cnh_user_code', clean);
      return true;
    },

    // Export complete progress bundle as a portable string
    exportProgressPayload() {
      const payload = {
        code: this.getUserCode(),
        stats: JSON.parse(localStorage.getItem('cnh_stats_v4') || '{}'),
        difficulty: JSON.parse(localStorage.getItem('cnh_user_difficulty_v4') || '{}'),
        achievements: JSON.parse(localStorage.getItem('cnh_achievements_v4') || '[]'),
        timestamp: Date.now()
      };
      return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    },

    // Import progress bundle string
    importProgressPayload(encodedStr) {
      try {
        const jsonStr = decodeURIComponent(escape(atob(encodedStr.trim())));
        const data = JSON.parse(jsonStr);

        if (!data.stats) throw new Error('Dados inválidos');

        if (data.code) localStorage.setItem('cnh_user_code', data.code);
        if (data.stats) localStorage.setItem('cnh_stats_v4', JSON.stringify(data.stats));
        if (data.difficulty) localStorage.setItem('cnh_user_difficulty_v4', JSON.stringify(data.difficulty));
        if (data.achievements) localStorage.setItem('cnh_achievements_v4', JSON.stringify(data.achievements));

        return true;
      } catch (e) {
        console.error('Import error:', e);
        return false;
      }
    }
  };

  window.cnhSync = sync;
})();
