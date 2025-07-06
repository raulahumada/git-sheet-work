# Configuración de Azure DevOps

Esta guía te ayudará a configurar la integración con Azure DevOps para sincronizar commits automáticamente con Google Sheets.

## Requisitos previos

1. Una cuenta de Azure DevOps
2. Un proyecto y repositorio en Azure DevOps
3. Configuración previa de Google Sheets (ver `GOOGLE_SHEETS_SETUP.md`)

## Paso 1: Crear un Personal Access Token (PAT)

1. Ve a tu organización de Azure DevOps: `https://dev.azure.com/TU_ORGANIZACION`
2. Haz clic en tu avatar en la esquina superior derecha
3. Selecciona **"Personal access tokens"**
4. Haz clic en **"+ New Token"**
5. Configura el token:
   - **Name**: `Git Sheet Work Integration`
   - **Organization**: Selecciona tu organización
   - **Expiration**: Configura según tus necesidades (recomendado: 1 año)
   - **Scopes**: Selecciona **"Custom defined"** y marca:
     - ✅ **Code (read)** - Para leer commits y archivos
     - ✅ **Code (status)** - Para leer información de commits
6. Haz clic en **"Create"**
7. **¡IMPORTANTE!** Copia el token generado inmediatamente, no podrás verlo después

## Paso 2: Obtener información del repositorio

Necesitarás la siguiente información de tu repositorio:

### Organización

De la URL: `https://dev.azure.com/MI_ORGANIZACION/mi-proyecto`

- La organización es: `MI_ORGANIZACION`

### Proyecto

De la URL: `https://dev.azure.com/mi-organizacion/MI_PROYECTO`

- El proyecto es: `MI_PROYECTO`

### Repositorio

1. Ve a tu proyecto en Azure DevOps
2. Navega a **Repos**
3. El nombre del repositorio aparece en la parte superior (usualmente es el mismo nombre del proyecto)

## Paso 3: Configurar variables de entorno

Agrega las siguientes variables a tu archivo `.env`:

```env
# Azure DevOps Configuration
AZURE_DEVOPS_ORGANIZATION=tu_organizacion
AZURE_DEVOPS_PROJECT=tu_proyecto
AZURE_DEVOPS_REPOSITORY=tu_repositorio
AZURE_DEVOPS_PAT=tu_personal_access_token
```

### Ejemplo real:

```env
# Azure DevOps Configuration
AZURE_DEVOPS_ORGANIZATION=miempresa
AZURE_DEVOPS_PROJECT=MiProyectoWeb
AZURE_DEVOPS_REPOSITORY=MiProyectoWeb
AZURE_DEVOPS_PAT=abcd1234efgh5678ijkl9012mnop3456qrst7890
```

## Paso 4: Probar la configuración

1. Reinicia tu aplicación: `npm run dev`
2. Ve a la interfaz web
3. En la sección **"Sincronizar desde Azure DevOps"**:
   - Ingresa el ID de un commit reciente (puedes copiarlo desde Azure DevOps)
   - Haz clic en **"Sincronizar"**
4. Si todo está configurado correctamente, verás un mensaje de éxito

## Funcionalidades disponibles

### 1. Sincronizar commit específico

- Ingresa el ID completo del commit (40 caracteres)
- La aplicación obtendrá la información del commit y lo sincronizará con Google Sheets
- Se creará una fila por cada archivo modificado

### 2. Sincronizar commits recientes

- Especifica cuántos commits recientes quieres sincronizar (1-50)
- Todos los commits se sincronizarán automáticamente

## Formato en Google Sheets

Cada archivo modificado se guardará en una fila separada con:

| Hash del Commit | Mensaje  | Autor | Fecha del Commit | Archivo Modificado | Tipo de Archivo     | Timestamp            |
| --------------- | -------- | ----- | ---------------- | ------------------ | ------------------- | -------------------- |
| a1b2c3d...      | Fix bugs | Juan  | 2024-01-01       | Default.aspx       | Página ASPX (.aspx) | 2024-01-01T10:00:00Z |
| a1b2c3d...      | Fix bugs | Juan  | 2024-01-01       | DataAccess.vb      | Clase (.vb)         | 2024-01-01T10:00:00Z |

## Tipos de archivo soportados

La aplicación identifica automáticamente estos tipos:

- `.aspx` → Página ASPX (.aspx)
- `.resx` → Hoja de Recurso (.resx)
- `.dll` → Componente (DLL) (.dll)
- `.rpt` → Reporte (RPT) (.rpt)
- `.vb` → Clase (.vb)
- Otros → Otro (.extensión)

## Solución de problemas

### Error: "Azure DevOps no está configurado"

- Verifica que todas las variables de entorno estén configuradas
- Asegúrate de que el archivo `.env` esté en la raíz del proyecto
- Reinicia la aplicación después de cambiar las variables

### Error: "Error al obtener commit: 401"

- El Personal Access Token es inválido o ha expirado
- Verifica que el token tenga los permisos correctos (Code - read)
- Crea un nuevo token si es necesario

### Error: "Error al obtener commit: 404"

- Verifica que la organización, proyecto y repositorio sean correctos
- Asegúrate de que el commit ID existe en el repositorio
- Verifica que tengas acceso al repositorio

### Error: "Unable to parse range"

- El ID del commit debe ser el hash completo (40 caracteres)
- Puedes obtenerlo desde Azure DevOps en la sección de commits

## Seguridad

- El Personal Access Token se almacena como variable de entorno
- Nunca compartas tu token o lo incluyas en el código
- Configura una fecha de expiración apropiada para el token
- Revisa periódicamente los tokens activos en tu cuenta
