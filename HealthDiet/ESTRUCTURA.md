# Organización de HealthDiet

Esta carpeta contiene la versión local de la aplicación. `index.html` reúne la
estructura de las pantallas y carga los archivos JavaScript con `defer`, en el
orden indicado en el propio documento. El servidor `iniciar.py` sirve la carpeta
en localhost; los datos permanecen en Supabase.

## Archivos JavaScript

- `cuenta.js`: crea el cliente de Supabase, mantiene la sesión y el espacio
  seleccionado, coordina las pantallas y actualiza los datos comunes.
- `recetas.js`: buscador, tarjetas, formulario, ordenación y eliminación de
  recetas. Consulta a Supabase mediante las funciones que recibe de `cuenta.js`.
- `menus-compartidos.js`: edición y presentación de menús, selección del menú
  activo y coordinación de las vistas de cocina y compra.
- `cocinar-juntos.js`: presenta las recetas del menú activo para un día.
- `compra.js`: agrupa ingredientes del menú activo y guarda las marcas de compra.
- `configuracion.js`: nombre, contraseña, color y táperes del espacio.
- `cantidades.js`: presenta cantidades por persona y calcula totales de una receta.
- `dialogos.js`: muestra avisos y confirmaciones con la estética de la aplicación.

Los módulos usan funciones de creación compartidas en `window` y reciben las
herramientas que necesitan. El estado compartido y la secuencia de actualización
se coordinan desde `cuenta.js`; `menus-compartidos.js` mantiene el estado del
editor y llama a las vistas de cocina y compra. El orden de carga importa.

## Interfaz y estilos

- `index.html`: cabecera, navegación, pantallas, formularios y diálogos.
- `css/estilos.css`: estilos generales y componentes de la interfaz.
- `css/cuenta.css`: ajustes de cuenta y de las vistas compartidas, tarjetas,
  diálogos y formularios. Sus reglas complementan las del archivo anterior.
- `imagenes/logo.webp`: logotipo.

## Cambios y pruebas

Consulta `LEEME.txt` para iniciar la versión local, probar cambios y volver a un
ZIP anterior. El archivo local se conecta a Supabase: para crear, editar o borrar
datos durante las pruebas, utiliza un espacio de prueba independiente. Antes de
publicar, comprueba en un navegador el acceso, cada pantalla y las operaciones
modificadas; las pruebas simuladas no sustituyen las pruebas con cuentas reales.
