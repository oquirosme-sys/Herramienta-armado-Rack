/* Configuración de la herramienta.
   PASO 2 (posterior): al crear la base de datos en Supabase, complete SUPABASE_URL y SUPABASE_ANON_KEY
   (la clave "anon" es pública por diseño; la seguridad real la dan Auth + Row Level Security). */
window.CONFIG = {
  APP_NAME: 'Etiquetado y racks de telecomunicaciones',
  APP_VERSION: '1.3-web.1',

  // 'local' = datos en el navegador (paso 1). 'supabase' = base de datos (paso 2).
  BACKEND: 'local',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Modo administrador LOCAL (paso 1): hash SHA-256 de la contraseña. Contraseña inicial: sinergia-admin
  // Se puede cambiar desde Administración > Seguridad y respaldo.
  // OJO: en una página estática esto solo oculta la edición del catálogo; NO es seguridad real.
  // La restricción real (solo administradores escriben el catálogo) se hace con Supabase Auth + RLS en el paso 2.
  ADMIN_PASSWORD_SHA256: '82d2d4d5048a9d1e08dd203c734fc77db900f7424336509f26be652dcc1d7eb6',
};
