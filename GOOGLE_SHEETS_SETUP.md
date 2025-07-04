# Configuración de Google Sheets API

Esta guía te ayudará a configurar la integración con Google Sheets para sincronizar automáticamente tus commits.

## Pasos de configuración

### 1. Crear un proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el ID del proyecto

### 2. Habilitar Google Sheets API

1. En Google Cloud Console, ve a "APIs & Services" > "Library"
2. Busca "Google Sheets API"
3. Haz clic en "Enable"

### 3. Crear una Service Account

1. Ve a "APIs & Services" > "Credentials"
2. Haz clic en "Create Credentials" > "Service Account"
3. Completa el formulario:
   - **Service Account Name**: `git-sheet-work-service`
   - **Service Account ID**: se generará automáticamente
   - **Description**: `Service account para Git Sheet Work`
4. Haz clic en "Create and Continue"
5. En "Grant this service account access to project":
   - Rol: `Editor` o `Viewer` (según tus necesidades)
6. Haz clic en "Continue" y luego "Done"

### 4. Crear y descargar credenciales

1. En la lista de Service Accounts, encuentra la cuenta que acabas de crear
2. Haz clic en el email de la service account
3. Ve a la pestaña "Keys"
4. Haz clic en "Add Key" > "Create new key"
5. Selecciona formato "JSON"
6. Haz clic en "Create" - se descargará un archivo JSON

### 5. Crear tu hoja de Google Sheets

1. Ve a [Google Sheets](https://sheets.google.com)
2. Crea una nueva hoja de cálculo
3. Nómbrala algo como "Git Commits Log"
4. Anota el ID de la hoja (está en la URL):
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```

### 6. Compartir la hoja con la Service Account

1. En tu hoja de Google Sheets, haz clic en "Share" (Compartir)
2. En el campo de email, ingresa el email de tu service account (lo encuentras en el archivo JSON descargado)
3. Asigna permisos de "Editor"
4. Haz clic en "Send" (Enviar)

### 7. Configurar variables de entorno

Crea un archivo `.env` en la raíz de tu proyecto con las siguientes variables:

```env
# ID de tu hoja de Google Sheets (extraído de la URL)
GOOGLE_SHEETS_SPREADSHEET_ID=tu_spreadsheet_id_aqui

# Email de tu service account (del archivo JSON)
GOOGLE_SHEETS_CLIENT_EMAIL=tu-service-account@tu-proyecto.iam.gserviceaccount.com

# Clave privada de tu service account (del archivo JSON, mantener los \n literales)
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----\n"
```

### 8. Extraer datos del archivo JSON

Del archivo JSON descargado, necesitas estos campos:

```json
{
  "type": "service_account",
  "project_id": "tu-proyecto-123456",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "git-sheet-work-service@tu-proyecto-123456.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

- `client_email` → `GOOGLE_SHEETS_CLIENT_EMAIL`
- `private_key` → `GOOGLE_SHEETS_PRIVATE_KEY`

### 9. Estructura de la hoja de Google Sheets

La aplicación creará automáticamente estos headers en la hoja "Commits":

| Hash del Commit | Mensaje                    | Autor      | Fecha del Commit    | Archivos Modificados       | Timestamp de Registro    |
| --------------- | -------------------------- | ---------- | ------------------- | -------------------------- | ------------------------ |
| a1b2c3d...      | Fix: Corregir bug en login | Juan Pérez | 2024-01-15 10:30:00 | app/auth.ts, app/login.tsx | 2024-01-15T10:31:22.000Z |

### 10. Probar la configuración

1. Inicia tu aplicación Remix: `npm run dev`
2. Navega a la página principal
3. Selecciona un repositorio git
4. En la sección de "Sincronización con Google Sheets":
   - Haz clic en "Configurar Hoja" para inicializar los headers
   - Haz clic en "Sincronizar último commit" para probar la conectividad

## Funcionalidades disponibles

### Sincronización automática

- Cada vez que haces un commit desde la aplicación, se sincroniza automáticamente con Google Sheets

### Sincronización manual

- **Último commit**: Sincroniza el último commit del repositorio
- **Commit específico**: Sincroniza un commit específico usando su hash
- **Ver datos**: Muestra cuántos commits tienes registrados en Google Sheets

### Configuración inicial

- **Configurar Hoja**: Crea los headers necesarios en tu hoja de Google Sheets

## Troubleshooting

### Error: "Faltan variables de entorno"

- Verifica que hayas configurado correctamente las tres variables en tu archivo `.env`
- Asegúrate de que no haya espacios en blanco adicionales

### Error: "No se pudo acceder a Google Sheets"

- Verifica que hayas compartido la hoja con el email de la service account
- Confirma que el ID de la hoja sea correcto
- Revisa que la Google Sheets API esté habilitada

### Error: "Invalid credentials"

- Verifica que la clave privada esté copiada completamente
- Asegúrate de que los `\n` estén preservados en la clave privada
- Confirma que el email de la service account sea correcto

### La hoja no se actualiza

- Verifica que hayas dado permisos de "Editor" a la service account
- Revisa la consola del navegador en busca de errores
- Confirma que el nombre de la hoja sea "Commits" (la aplicación usa este nombre por defecto)

## Seguridad

- **Nunca** subas tu archivo de credenciales JSON al repositorio
- Agrega `.env` a tu `.gitignore`
- Considera usar variables de entorno del servidor en producción
- La service account solo tiene acceso a las hojas que compartas con ella

## Personalización

Si quieres cambiar el nombre de la hoja o la estructura de las columnas, puedes modificar el archivo `app/services/google-sheets.server.ts`.
