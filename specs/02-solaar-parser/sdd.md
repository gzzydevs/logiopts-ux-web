* * *

# 🧠 1️⃣ Prompt — Parser JSON ⇄ YAML (Solaar)

* * *

### Prompt: Diseño e implementación del módulo `solaar/` (Parser + Tests)

Ayudame a hacer SDD, armemos un plan técnico y una spec detallada para el siguiente desarrollo:

## 🎯 Tarea

Necesitamos un módulo `solaar/` que permita transformar configuraciones internas en JSON hacia el formato YAML que utiliza Solaar, y viceversa.

Debe ser completamente testeable con Jest.

La transformación debe ser **determinística, reversible y validable**.

* * *

## 📦 Stack

* Node.js
    
* Express
    
* `yaml` o `js-yaml`
    
* Jest
    
* TypeScript (preferible)
    

* * *

## 🗂 Estructura esperada

/server  
  /solaar  
    parser.ts  
    schema.ts  
    validator.ts  
    index.ts  
    __tests__/  
      json-to-yaml.test.ts  
      yaml-to-json.test.ts  
      roundtrip.test.ts

* * *

## 📌 Requisitos funcionales

### 1️⃣ Conversión JSON → YAML

* Recibir un JSON con esta estructura base:
    

TypeScript{  
  deviceId: string,  
  profile: string,  
  buttons: [  
    {  
      id: string,  
      actions: {  
        click: Macro,  
        up?: Macro,  
        down?: Macro,  
        left?: Macro,  
        right?: Macro  
      }  
    }  
  ]  
}

* Generar YAML compatible con el formato que Solaar espera
    
* Respetar indentación exacta
    
* Soportar múltiples dispositivos
    
* Soportar múltiples perfiles
    

* * *

### 2️⃣ Conversión YAML → JSON

* Leer YAML existente
    
* Parsearlo correctamente
    
* Normalizar datos faltantes
    
* Validar estructura
    

* * *

### 3️⃣ Validación

* Implementar un schema interno
    
* Validar:
    
    * macros inválidos
        
    * combinaciones de teclas mal formadas
        
    * scripts inexistentes
        
* Lanzar errores claros y estructurados
    

* * *

### 4️⃣ Testing profundo con Jest

Crear tests para:

* Conversión simple
    
* Conversión con gestos
    
* Múltiples botones
    
* Múltiples perfiles
    
* Múltiples dispositivos
    
* YAML malformado
    
* JSON inválido
    
* Roundtrip test:
    

TypeScriptJSON -> YAML -> JSON

Debe producir el mismo resultado normalizado.

* * *

### 5️⃣ Edge cases importantes

* Botón sin acciones
    
* Perfil vacío
    
* YAML con campos desconocidos
    
* Orden inconsistente
    
* Claves repetidas
    

* * *

### 6️⃣ Consideraciones Linux / Bazzite

* No escribir directamente sobre archivo de Solaar todavía
    
* Solo devolver string YAML
    
* TODO comment: reemplazar cuando módulo de persistencia esté listo
    

* * *

### 🧪 Objetivo final

Tener un módulo completamente independiente del resto del sistema que pueda:

TypeScriptconst yaml = jsonToSolaarYaml(config)  
const json = solaarYamlToJson(yaml)

Y que tenga cobertura > 90%.

* * *