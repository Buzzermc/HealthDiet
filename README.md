# HealthDiet

Aplicación para organizar recetas, menús semanales y la lista de la compra.

## Probar la aplicación

1. En GitHub, selecciona **Code → Download ZIP**.
2. Descomprime el archivo descargado.
3. Dentro de la carpeta `HealthDiet`, abre `index.html` en el navegador.

Conserva juntas las carpetas `css`, `js` e `imagenes`: la página las necesita para funcionar. No es necesario instalar dependencias ni utilizar Netlify para esta prueba.

Las recetas, menús y configuración se guardan en el navegador y dispositivo; todavía no se sincronizan con Supabase. Las marcas de la compra son temporales. Al cambiar la ubicación del archivo o de navegador, los datos anteriores podrían no aparecer: conserva la copia anterior hasta comprobarlos.

## Organización

- `HealthDiet/index.html`: estructura y pantallas.
- `HealthDiet/css/estilos.css`: estilos.
- `HealthDiet/js/recetas.js`, `menus.js`, `cocinar-juntos.js`, `compra.js` y `configuracion.js`: lógica de cada sección.
- `HealthDiet/js/utilidades.js` y `app.js`: funciones compartidas e inicio.
- `HealthDiet/imagenes/logo.webp`: logotipo.

Los scripts se cargan en el orden indicado en `index.html`, ya que comparten funciones. `platos.html` redirige a la entrada principal.
