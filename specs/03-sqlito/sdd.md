
* * *

# 💾 2️⃣ Prompt — Persistencia SQLite + Estado en Memoria

* * *

### Prompt: Diseño de módulo de persistencia con SQLite + integración Express

Ayudame a diseñar e implementar la capa de persistencia para nuestra app de configuración Logitech en Linux.

* * *

## 🎯 Objetivo

Ampliar el servidor Express para:

* Guardar perfiles por aplicación
    
* Guardar configuraciones por dispositivo
    
* Mantener en memoria JSON y YAML
    
* Persistir scripts bash
    
* Soportar múltiples dispositivos
    

* * *

## 🛠 Stack

* Express
    
* SQLite (mejor: `better-sqlite3`)
    
* TypeScript
    
* Zod o schema validation
    
* fs/promises
    

* * *

## 🗂 Estructura esperada

/server  
  /db  
    schema.sql  
    index.ts  
    repositories/  
      device.repo.ts  
      profile.repo.ts  
      config.repo.ts  
      script.repo.ts  
  /state  
    memory-store.ts

* * *

## 📌 Requisitos funcionales

### 1️⃣ Al iniciar el server

* Endpoint:
    

GET /api/bootstrap

Debe devolver:

TypeScript{  
  devices: [],  
  profiles: [],  
  configs: [],  
  scripts: []  
}

Y poblar la UI.

* * *

### 2️⃣ Base de datos debe soportar

#### Tabla devices

* id
    
* name
    
* model
    
* image
    

#### Tabla profiles

* id
    
* deviceId
    
* appName
    
* isDefault
    

#### Tabla configs

* id
    
* profileId
    
* jsonConfig
    
* yamlConfig
    
* updatedAt
    

#### Tabla scripts

* id
    
* name
    
* path
    
* content
    
* executable
    

* * *

### 3️⃣ Estado en memoria

Implementar una capa intermedia:

* Mantiene JSON actual
    
* Mantiene YAML actual
    
* Evita recalcular parser innecesariamente
    
* Permite rollback si falla Solaar
    

* * *

### 4️⃣ Scripts Bash

* Guardar scripts en `/scripts`
    
* Poder editar vía endpoint
    
* Validar que no contengan comandos peligrosos (mínimo check básico)
    
* Marcar como ejecutables
    

* * *

### 5️⃣ Endpoints esperados

* GET /api/devices
    
* POST /api/devices
    
* GET /api/profiles
    
* POST /api/profiles
    
* PUT /api/config
    
* POST /api/scripts
    
* PUT /api/scripts/:id
    

* * *

### 6️⃣ Consideraciones Bazzite / Flatpak

* No asumir permisos root
    
* Configurable path de Solaar
    
* TODO: verificar sandbox flatpak
    
* Manejar errores si Solaar no puede reiniciarse
    

* * *

### 🧠 Objetivo arquitectónico

Separar:

* Express routes
    
* Repositories
    
* In-memory state
    
* Solaar integration (futuro módulo)
    

* * *