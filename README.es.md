# Boosteroid Tweaks 🚀

[🇬🇧 English](README.md) | [🇷🇺 Русский](README.ru.md) | [🇺🇦 Українська](README.uk.md) | [🇪🇸 Español](README.es.md)

Boosteroid Tweaks es un potente Userscript que mejora significativamente tu experiencia con el servicio de juegos en la nube [Boosteroid](https://cloud.boosteroid.com/).

El script añade capacidades para gestionar servidores, protección robusta contra desconexiones por inactividad (Anti-AFK), y una conveniente superposición (overlay) de estadísticas de sesión.

## ✨ Características y Ventajas

*   **🛡️ Anti-AFK Invisible (Protección contra desconexión por inactividad)**
    Olvídate de las advertencias de "¿Sigues ahí?" y el tiempo de espera de 10 minutos. El script intercepta las solicitudes de actividad de Boosteroid directamente en la capa de red (WebSocket) y responde instantáneamente al servidor. ¡El cuadro de advertencia ni siquiera aparece en tu pantalla! Perfecto para sesiones de juego largas o el uso de Steam Remote Play.
*   **🌍 Gestor de Servidores (Bloqueador de centros de datos con lag)**
    ¿Terminaste en un servidor con alto ping o mala calidad? El script detecta automáticamente tu servidor actual y te permite añadirlo a una "lista negra". La próxima vez que inicies un juego, el script bloqueará la conexión a ese servidor no deseado, obligando a Boosteroid a redirigirte a un centro de datos diferente.
*   **📊 Estadísticas Avanzadas (Better Stats)**
    Un overlay integrado (similar a los contadores de FPS de Steam o GeForce Experience) que muestra en tiempo real:
    *   **Ping (ms)** — latencia hasta el servidor
    *   **FPS** — velocidad de fotogramas del flujo de video
    *   **Bitrate** — tasa de bits actual de la red (Mbps)
    *   **Loss** — pérdida de paquetes (afecta los congelamientos)
    *   **Resolution** — resolución real del flujo de video
*   **🎨 Interfaz de Usuario Limpia**
    Se puede acceder a la configuración haciendo clic en el ícono de engranaje, y está integrada directamente en la página de Boosteroid usando la tecnología Shadow DOM (lo que garantiza que no haya conflictos con el diseño del sitio).
*   **🌐 Multilenguaje**
    Soporta inglés, ruso, ucraniano y español, adaptándose automáticamente al idioma de tu sistema.

---

## ⚙️ Cómo Instalar

La instalación toma solo un par de minutos:

1. **Instala la extensión Tampermonkey** para tu navegador (compatible con Chrome, Firefox, Edge, Safari, Opera):
   * [Tampermonkey para Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   * [Tampermonkey para Firefox](https://addons.mozilla.org/ru/firefox/addon/tampermonkey/)
   * [Tampermonkey para Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
   
2. **Instala el script:**
   * Abre la extensión Tampermonkey y selecciona **"Crear un nuevo script"** (Create a new script).
   * Elimina todo el contenido en el editor que se abre.
   * Copia todo el código del archivo `boosteroid_tweaks.user.js` de este repositorio y pégalo en el editor de Tampermonkey.
   * Presiona `Ctrl+S` (o Archivo -> Guardar) para guardar el script.

3. **¡Listo!**
   * Ve a [cloud.boosteroid.com](https://cloud.boosteroid.com/).
   * En la esquina inferior izquierda de la pantalla (o en la página de inicio), verás el ícono de **Boosteroid Tweaks** ⚙️. ¡Haz clic en él para configurar!

---

## 📝 Cómo usar el Gestor de Servidores

1. Inicia cualquier juego.
2. Abre el panel de **Boosteroid Tweaks** (el botón ⚙️).
3. En la sección **"Último Servidor"**, verás la dirección del centro de datos al que estás conectado (por ejemplo, `gw-par.boosteroid.com`).
4. Si el servidor tiene mal rendimiento (alto ping/pérdida de paquetes), haz clic en el botón **"Bloquear este servidor"**.
5. Finaliza la sesión e inicia el juego de nuevo — el script bloqueará la conexión a esa dirección, y Boosteroid seleccionará un centro de datos diferente para ti.

---

## 👨‍💻 Para Desarrolladores

El script utiliza técnicas avanzadas de inyección:
* Sobrescribir el constructor `window.WebSocket` para monitorear y filtrar el tráfico de red con los servidores de Boosteroid (Anti-AFK y bloqueo).
* Usar la API de WebRTC (`RTCPeerConnection`) para recopilar telemetría nativa sin retrasos.

**Descargo de responsabilidad:** *Este proyecto no es un producto oficial de Boosteroid y es desarrollado por la comunidad. Úselo bajo su propio riesgo.*
