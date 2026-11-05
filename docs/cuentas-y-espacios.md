# Diseño de cuentas y espacios compartidos (en preparación)

Esta propuesta describe el comportamiento acordado. Todavía no implementa autenticación ni modifica la base de datos.

## Cuentas y espacios

- Supabase Auth gestiona correo, contraseña, confirmación de correo y recuperación de contraseña.
- Una cuenta solo puede pertenecer a un espacio activo. Una restricción única en la base de datos debe garantizarlo también ante peticiones simultáneas.
- Una persona autenticada puede crear un espacio y pasa a ser su administradora en la misma transacción.
- La administradora invita por correo. La persona invitada debe verificar y autenticarse con ese correo y aceptar la invitación antes de incorporarse.
- La administradora gestiona miembros, invitaciones y traspaso de administración. Los miembros pueden gestionar recetas, menús y compra.
- La última administradora no puede abandonar el espacio sin traspasar la administración a otra persona activa.

## Datos y permisos

- Separar identidad de usuario, espacio, pertenencia activa y persona histórica asociada al espacio.
- Los ingredientes guardan cantidades referenciando identificadores estables de persona, no nombres ni posiciones.
- Al salir, se revoca la pertenencia, pero se conserva la persona histórica y sus cantidades como referencia; no participa en nuevas recetas ni totales activos.
- El aislamiento entre espacios y los permisos se aplican en la base de datos con RLS y restricciones, no solo en la interfaz.
- El correo de una invitación se comprueba a partir de la identidad verificada, nunca de datos editables del perfil.
- Crear espacio, aceptar invitación, expulsar, abandonar y traspasar administración requieren operaciones atómicas y comprobaciones de autorización en el servidor.
- Usar exclusivamente una clave publicable en el navegador. No incluir claves secretas ni service_role.
- Revisar y probar los permisos con usuarios de distintos espacios, invitaciones caducadas y revocación de acceso.

## Interfaz

- Registro, inicio y cierre de sesión, recuperación y cambio de contraseña.
- Un espacio vacío tras registro o incorporación; no importar datos locales de prueba.
- Perfil de receta: personas activas y «Todos» solo cuando hay varias; una cantidad por persona y por ingrediente.
- Al incorporarse una persona no se le asignan cantidades automáticamente.
- Colores individuales; táperes compartidos.
- Sustituir todas las referencias fijas a Pablo, Alba y Ambos en configuración, recetas, menús, cocinar juntos y compra.
- Guardar recetas, menús y configuración en Supabase bajo el espacio; no usar el almacenamiento local como fuente compartida.

## Aspectos de puesta en marcha

La confirmación y recuperación por correo requieren una URL web estable autorizada en Supabase Auth y una configuración de correo adecuada. La invitación necesita también un mecanismo de envío fiable; no exponer credenciales de envío en el navegador.

Antes de activar la función: pruebas de registro, verificación de correo, acceso, recuperación, invitación, aceptación, aislamiento, traspaso, abandono, cantidades, menús y compras; revisar asesores de seguridad y explicar cómo probar la versión completa.
