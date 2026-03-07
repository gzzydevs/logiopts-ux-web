# Prompt original — Spec 09

Generar un instalador o sistema de paquetería que permita instalar el programa con la mayor cantidad posible de gestores de paquetes (rpm, deb, etc.) para su distribución.

Ya que lo estamos convirtiendo en un programa distribuible, investigar cómo convertir esta app que corre en el browser en una app de escritorio, similar a como funciona Logi Options+ de verdad. La elección más probable sea Electron.

**Requisitos:**

- Opción de configurar el inicio automático al encender la PC.
- Iterar el tema de Solaar:
  - Si no está corriendo, mostrar un mensaje claro de que no está activo y ofrecer la opción de iniciarlo.
  - Si no se encuentra en el sistema, mostrar un cartel indicando que no se pudo detectar la instalación. Lo ideal es leer desde los procesos del sistema si está corriendo, no depender de comandos CLI.
- Permitir minimizar el programa como tray icon en la barra de tareas, tanto al cerrarlo como desde el menú.
