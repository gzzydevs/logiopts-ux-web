# Prompt original — Spec 08

Quiero iterar la solución de scripts: que con algunos botones del mouse se puedan ejecutar scripts personalizados según el usuario y el sistema operativo. Actualmente hay unos pocos hardcodeados en la carpeta `scripts/`, pero los usuarios deberían poder crearlos a demanda.

**Requisitos:**

- La implementación usa Solaar, no podemos dejarlo de lado. Explorar dos opciones:
  - **Opción 1**: ejecutar los scripts usando las capacidades nativas de Solaar (acción `Execute` en rules.yaml).
  - **Opción 2**: mapear el botón del mouse a una tecla que elija el usuario (por ejemplo F12), y desde el servidor detectar la presión de esa tecla. Si tiene un script asignado, ejecutarlo.
- Los scripts deben guardarse en la configuración de la app.
- Mejorar la interfaz para que sea lo más clara posible cuando se seleccione una acción de tipo bash/script.
- Agregar un editor in-browser para poder modificar el script en el momento. Si también sirve para dar permisos de ejecución, mejor. Buscar una dependencia open source pero segura (pocas dependencias transitivas, sin vulnerabilidades conocidas). Si no existe algo adecuado, implementar el editor a mano.
