# Etiquetado y racks de telecomunicaciones (web)

Herramienta HTML basada en `Etiquetado y racks de telecomunicaciones REV1.xlsx` (v1.3). Sin dependencias ni compilación: se publica tal cual en **GitHub Pages**.

## Publicar en GitHub Pages
1. Suba todo el contenido de esta carpeta a la raíz de un repositorio.
2. *Settings ▸ Pages ▸ Deploy from a branch ▸ `main` / `(root)`*.
3. Abra `https://<usuario>.github.io/<repositorio>/`. (También funciona abriendo `index.html` directamente.)

## Cómo está organizada
| Pestaña | Qué hace |
|---|---|
| **Proyecto** | Datos del proyecto, jack por defecto, reserva de cableado y alta de **niveles**. Cada nivel crea su pestaña. |
| **Nivel (1A, 1B…)** | *Rack y equipos* (elevación, ocupación, potencia/calor/peso), *Etiquetado de puertos* y *Tramos* de canastas/tuberías y cableado. |
| **Memoria de cálculo** | Resumen de cuartos, salidas por tipo, canalización, cableado, potencia y lista de materiales (imprimir/PDF y CSV). |
| **Administración** *(solo admin)* | Catálogo (equipos, canastas, tuberías, cableado), categorías, marcas, tipos de salida, referencias, respaldo y revisiones. |

Las hojas informativas del Excel (INICIO_TR, FIN_TR, listas, Revisiones, MUESTRA…) no aparecen: las plantillas MUESTRA son ahora opciones al agregar un nivel y las revisiones están en Administración.

## Modo administrador (paso 1)
Contraseña inicial: `sinergia-admin` (cámbiela en *Administración ▸ Seguridad y respaldo*).
En una página estática esto **solo oculta** la edición; la restricción real se implementa en el paso 2 con Supabase Auth + Row Level Security.

## Datos (paso 1)
Proyecto y catálogo se guardan en `localStorage` del navegador. Use *Archivo ▸ Exportar proyecto* y *Administración ▸ Exportar catálogo* para respaldar o compartir.
El catálogo inicial sale del Excel (`js/data/seed.js`).

## Paso 2 (pendiente): Supabase
Todo el acceso a datos pasa por `js/store.js`; ahí se reemplaza `localStorage` por Supabase. El modelo ya está separado en:
- **Catálogo** (`categorias`, `items`, `marcas`, `tiposSalida`, `referencias`, `revisiones`): lectura para todos, escritura solo rol `admin`.
- **Proyecto** (`proyecto` → `niveles` → `equipos`, `fuera`, `portTipos`, `tramos`): por usuario/proyecto.
- `js/config.js` ya tiene los campos `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

## Estructura
```
index.html
css/styles.css
js/config.js  util.js  calc.js  store.js  auth.js  ui.js
js/ui-project.js  ui-room.js  ui-memoria.js  ui-admin.js  app.js
js/data/seed.js        (catálogo y plantillas generados del Excel)
```
`js/calc.js` es el motor de cálculo (sin DOM): posición en rack, etiquetado, materiales, potencia y tramos.
