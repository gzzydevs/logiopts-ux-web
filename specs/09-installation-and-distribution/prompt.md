# Prompt para replantear Spec 09 — Desktop Packaging Strategy

Necesito que revises y replantees completamente el plan de implementación de **Spec 09**.
El plan actual eligió **Electron**, pero después de analizarlo mejor **esa probablemente no sea la mejor arquitectura para este proyecto**.

Quiero que vuelvas a pensar la solución **desde cero**, priorizando simplicidad, mantenibilidad y facilidad de distribución en Linux.

---

# Contexto técnico del proyecto

La aplicación actual es:

* Frontend: React + Vite
* Backend: Express
* Base de datos: SQLite
* Arquitectura: aplicación web local (UI servida desde Express)

Actualmente funciona así:

browser → http://localhost → express → sqlite

El servidor Express sirve el build de React y expone endpoints API.

---

# Problema actual

El plan que generaste propone:

* Reescribir gran parte del sistema para usar Electron
* Ejecutar Express como proceso hijo
* Mantener una ventana Chromium embebida

Pero esto introduce varios problemas.

### 1. Overhead innecesario

Electron incluye Chromium completo:

* binarios de 200–300MB
* alto consumo de RAM
* complejidad adicional

Para esta aplicación **no es estrictamente necesario un navegador embebido**.

### 2. Complejidad innecesaria

El plan agrega muchas capas:

* main process
* preload
* IPC
* electron-builder
* packaging complejo

Cuando la app **ya funciona como aplicación web local**.

### 3. Acoplamiento fuerte

Electron acopla la app a un runtime específico cuando el proyecto ya funciona bien como:

local web application

---

# Nueva dirección arquitectónica

En lugar de Electron, quiero que evalúes una arquitectura **mucho más simple**.

### Modelo: "Local Web App + Standalone Binary"

La idea es:

1. Compilar el frontend con Vite
2. Servir los archivos estáticos desde Express
3. Empaquetar el servidor Node + assets en un solo ejecutable
4. Al ejecutar el binario:

* levantar Express
* abrir el navegador del sistema en localhost

Arquitectura final:

usuario ejecuta binario
↓
servidor express se inicia
↓
abre navegador del sistema
↓
UI React se carga desde localhost
↓
SQLite funciona normalmente

Este patrón lo usan muchas herramientas dev y self-hosted apps.

---

# Requisito importante de packaging

El ejecutable debe generarse usando **Node SEA (Single Executable Applications)**.

No usar:

* pkg
* nexe
* herramientas externas similares

El objetivo es **no agregar dependencias de build externas** y usar únicamente capacidades nativas de Node.js.

El resultado final debe ser:

./logitux

que funcione **sin requerir Node instalado en el sistema**.

---

# Requisito importante sobre archivos estáticos

Dado que **Node SEA empaqueta el código dentro del binario**, los archivos del frontend (por ejemplo el build generado por Vite) **no existirán como archivos físicos en el filesystem** cuando la aplicación se ejecute.

El plan debe contemplar esto explícitamente.

Una estrategia aceptable es que, al iniciar el binario:

1. los assets del frontend (dist-web) se extraigan a un directorio temporal
2. por ejemplo:

/tmp/logitux-web/

3. y que Express sirva los archivos estáticos desde ese directorio temporal.

El objetivo es mantener la simplicidad del uso de `express.static` evitando errores de filesystem cuando se usa SEA.

---

# Objetivos del nuevo plan

Necesito que generes **un nuevo implementation plan completo** basado en esta arquitectura.

El plan debe cubrir:

---

# 1. Packaging como ejecutable standalone

Explicar cómo usar **Node SEA** para generar el binario.

El plan debe incluir:

* build del frontend con Vite
* inclusión del servidor Express
* inclusión de assets necesarios
* inclusión de dependencias npm

El resultado final debe ser un ejecutable único:

logitux

---

# 2. Estructura final del proyecto

Definir cómo debería quedar la estructura:

project
├ server
├ web
├ dist-web
├ data
└ build

y cómo integrar:

* Vite build
* Express static hosting
* SQLite
* scripts existentes

---

# 3. Directorio de datos persistentes

Mantener el comportamiento actual:

~/.local/share/logitux/

para:

logitux.db
scripts/

Definir claramente:

* cómo detectarlo
* cómo inicializarlo
* cómo migrar si no existe

---

# 4. Inicio automático (autostart)

Mantener el sistema basado en:

~/.config/autostart/logitux.desktop

El `Exec=` debe apuntar al **binario standalone**.

---

# 5. Detección de Solaar

La app debe seguir pudiendo:

* detectar si **Solaar está instalado**
* detectar si **Solaar está corriendo**
* permitir **iniciarlo**

Esto debería implementarse desde el **backend Express**, usando por ejemplo:

* `pgrep`
* inspección de procesos
* detección de rutas del binario

No asumir Electron.

---

# 6. Apertura automática del navegador

Al ejecutar el binario:

1. levantar Express
2. esperar a que el server esté listo
3. abrir navegador del sistema

Ejemplo conceptual:

./logitux
→ server starts
→ browser opens http://localhost:3000

---

# 7. Distribución en Linux

Definir cómo generar:

* `.deb`
* `.rpm`
* `AppImage`

Idealmente usando el mismo binario.

Investigar herramientas como:

* `fpm`
* `appimagetool`

---

# 8. Integración con el sistema Linux

Durante la instalación del paquete (`deb` / `rpm`):

Debe crearse automáticamente un **launcher de escritorio**:

/usr/share/applications/logitux.desktop

Este launcher debe:

* aparecer en el **menu de aplicaciones**
* permitir crear **accesos directos en el escritorio**
* ejecutar el binario principal

---

# 9. Comportamiento del launcher

Cuando el usuario abra la aplicación desde:

* el menú de aplicaciones
* un acceso directo del escritorio

la aplicación **debe abrir una terminal visible** que ejecute el proceso del servidor.

Esto se logra usando el campo estándar:

Terminal=true

Ejemplo:

[Desktop Entry]
Name=Logitux
Exec=/usr/bin/logitux
Type=Application
Terminal=true
Categories=Utility;

Esto permite:

* ver logs
* debugging sencillo
* cerrar la app con Ctrl+C

---

# Requisitos importantes

### No romper el modo actual

Debe seguir funcionando:

npm run server:dev
npm run web:dev

sin el ejecutable standalone.

---

### Mantener compatibilidad web

La aplicación **debe seguir pudiendo correr solo en el navegador** si se desea.

---

### Minimizar complejidad

Evitar introducir:

* Electron
* Chromium embebido
* IPC innecesario

salvo que exista una razón técnica fuerte.

---

# Resultado esperado

Necesito que generes:

1. Un nuevo **Implementation Plan completo**
2. Justificación técnica de la arquitectura elegida
3. Comparación con la solución basada en Electron
4. Orden claro de implementación

El objetivo final es que la aplicación pueda distribuirse como:

./logitux

y funcione como una **desktop-like app**, pero internamente siga siendo una **local web application**.

Priorizar:

* simplicidad
* portabilidad
* bajo consumo
* mantenimiento a largo plazo
