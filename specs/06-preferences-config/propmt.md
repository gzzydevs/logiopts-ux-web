escribi un nuevo spec en esta carpeta, que sea para iterar las configuraciones de usuario, por ejemplo que recuerde cosas como la config del windows watcher

- que recuerde el ultimo perfil seleccionado.
- desarrollar y almacenar multiples perfiles
- que si esta activado el window watcher, adapte el perfil del mouse apenas se de cuenta.
- diferenciar perfil por default de perfil activo, es decir, en el ideal apenas se entre a la pagina, lo que le vamos a mostrar es lo que esta cargado a ahora en el mouse, que el profile diga "active" cuando sea diferente. Ese perfil active se debe mantener en memoria y ser un concepto a parte del default, es decir, imagina que yo tengo activo el window watcher y mi mouse tiene guardada otra config, el caso de uso seria asi:

- usuario tiene perfil activo -> entra a firefox -> busca si hay profile de firefox
    camino 1: tiene profile de firefox -> carga profile de firefox -> se va a otra app -> no tiene profile para esa app -> carga el profile active
    camino 2: NO tiene profile de firefox -> carga profile active

Generalmente el profile active y el default van a coincidir, pero el default esta guardado en db, el active esta asociado al mouse y queda en memoria.

- El boton de guardar debe funcionar.