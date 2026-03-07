# Prompt original — Spec 12

Genera un nuevo spec para que contemplen una mejora en la interfaz de profiles. Quiero que los profiles puedan almacenar y mostrar el icono asociado a la app. Ademas si es posible, que permita seleccionar la app entre un listado de apps instaladas en el sistema.

Quisiera que haya "una segunda topbar" una barrita mas abajo que tenga los iconos de las apps, y que al seleccionarlo, lo remarque con algun estilo y ese sea el layout actual, imagen de referencia (iconos arriba):

![referencia](https://github.com/user-attachments/assets/14c840e7-7b3d-4caf-b022-66be2826356a)

Luego, ademas de esto, es importante que el tema de poder editar el layout asocie esa edicion con el profile, es decir, que si yo quiero editar la disposicion de los botones, se quede almacenado en db dentro del profile, asi incluso cuando decida crear uno nuevo usando la opcion de "Clone from" tambien traiga la disposicion de botones asociada.

---

## Recordatorio de desarrollo

Usando `npm run dev:cloud` podés levantar el server en modo mocks (sin Solaar ni hardware real) y usar la interfaz con Playwright de forma mucho más cómoda. El modo mock levanta un MX Master 3 pre-configurado con 3 perfiles en memoria y no requiere ningún dispositivo físico conectado.
