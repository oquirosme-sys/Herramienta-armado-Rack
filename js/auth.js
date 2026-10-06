/* Roles: 'editor' (por defecto) y 'admin'. Solo el administrador ve/edita el catálogo
   (marcas, tipos de canasta/tubería/cableado, equipos, categorías, tipos de salida).
   Paso 1: acceso local con contraseña. Paso 2: se reemplaza por Supabase Auth + RLS (el rol vendrá del perfil). */
(function (g) {
  'use strict';
  const K = 'rackcode.rol.v1';
  const listeners = [];
  const Auth = {
    role: 'editor',
    init() { try { if (sessionStorage.getItem(K) === 'admin') Auth.role = 'admin'; } catch (e) { /* ignora */ } },
    isAdmin() { return Auth.role === 'admin'; },
    onChange(fn) { listeners.push(fn); },
    login(password) {
      if (U.sha256(password || '') !== Store.adminHash()) return false;
      Auth.role = 'admin'; try { sessionStorage.setItem(K, 'admin'); } catch (e) { /* ignora */ }
      listeners.forEach(f => f()); return true;
    },
    logout() {
      Auth.role = 'editor'; try { sessionStorage.removeItem(K); } catch (e) { /* ignora */ }
      listeners.forEach(f => f());
    },
  };
  g.Auth = Auth;
})(window);
