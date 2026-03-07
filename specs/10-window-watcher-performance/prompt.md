# Prompt original — Spec 10

Revisar la performance del window watcher. La solución actual es bastante básica: un `setInterval` que consulta cada 2 segundos qué ventana está activa.

**Requisitos:**

- Investigar si puede resolverse con un worker en C de forma más directa, y si el cambio de ventana pudiera detectarse de forma instantánea (event-driven en lugar de polling).
- Investigar si realmente hace falta reiniciar Solaar cada vez que se cambia la configuración. Tal vez exista algún comando en la documentación de Solaar que permita aplicar cambios de config rápidamente sin pasar por todo el proceso de reinicio, ya que el tiempo que consume no va a ser viable para el comportamiento automático del window watcher.
