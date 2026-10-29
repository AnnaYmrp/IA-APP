# Cronómetro Vital: Guía de Código Azul ⚡⏱️

Aplicación clínica de soporte y cronometría inteligente para la gestión de emergencias por **Paro Cardiorrespiratorio (PCR)** bajo lineamientos **ACLS (Advanced Cardiovascular Life Support)** de la American Heart Association (AHA).

Diseñada especialmente para estudiantes de enfermería, auxiliares y profesionales de la salud que asumen el rol de **cronometrista y registrador de eventos** en reanimación cardiopulmonar avanzada.

---

## 🎯 Solución a los Problemas Identificados en Versiones Previas

Basado en las pruebas de campo y los reportes de fallo de versiones anteriores, este desarrollo incorpora:

1. **Pantalla de Confirmación Previa al Inicio del Código**:
   - Evita arranques accidentales del reloj maestro.
   - Requiere validación de las 3 condiciones de PCR: *Paciente inconsciente*, *Ausencia de pulso carotídeo central (<10s)* y *Apnea o respiración agónica (gasping)* antes de activar el cronómetro general.

2. **Alarma de Adrenalina a los 3 Minutos con Código de Color Semafórico**:
   - **Verde brillante (0 - 2 min)**: Dosis activa reciente.
   - **Ámbar (2 - 3 min)**: Aviso de preparación de ampolla.
   - **Rojo pulsante (a los 3 min exactos)**: Alerta visual inmediata y banner destacado indicando: *"¡3 MINUTOS CUMPLIDOS: ADMINISTRAR SIGUIENTE DOSIS DE ADRENALINA (1 mg)!"*.

3. **Módulo de Desfibrilación con Selección Inmediata de Joules**:
   - Botón directo para seleccionar la energía de descarga: **120 J**, **150 J**, **200 J (Bifásico recomendado)** y **360 J (Monofásico)**, o carga personalizada.
   - Guarda la hora exacta de la descarga y reanuda el ciclo de compresiones torácicas sin interrupciones.

4. **Registro Rápido de Medicamentos y Dosis según Orden Médica**:
   - Acceso ultrarrápido a **Amiodarona** (300 mg / 150 mg), **Lidocaína** (100 mg / 50 mg), **Sulfato de Magnesio** (1-2 g), **Bicarbonato de Sodio** (50 mEq), **Gluconato de Calcio** (1-2 g) y **Dextrosa 50%**.
   - Campo para ingresar la dosis personalizada indicada por el médico líder con registro al segundo.

5. **Alarma Visual Morada de 2 Minutos (Ciclo RCP & Relevo de Masajista)**:
   - Cuenta regresiva precisa de 120 segundos con anillo de progreso visual.
   - Al cumplirse los 2 minutos, activa la **Alerta Morada** (`#7C3AED` / `#A855F7`) ordenando la pausa <10s, evaluación de ritmo y cambio obligatorio de operador de masaje cardíaco para evitar la fatiga y caída en la fracción de compresiones.

6. **Sistema de Audio Fail-Safe (Web Audio API Sintetizado)**:
   - Cero dependencias de archivos de sonido externos (.mp3/.wav) que causan errores 404 o bloqueos por políticas de autoplay de navegadores.
   - Los tonos se sintetizan en tiempo real mediante la `AudioContext` nativa del navegador.
   - Interruptor accesible en cabecera: **🔔 Sonido Activado** / **🔕 Modo Silencioso (100% Visual)** para evitar contaminación auditiva con monitores de signos vitales.

7. **Línea de Tiempo Cronológica y Reporte SBAR Exportable**:
   - Bitácora completa minuto a minuto con hora de reloj y tiempo de paro.
   - Resumen estructurado SBAR (*Situation, Background, Assessment, Recommendation*).
   - Botón de **"Copiar al Portapapeles EHR"** para pegar directo en historias clínicas electrónicas.
   - Botón de **"Exportar PDF / Imprimir"** con hoja de estilos optimizada para impresión clínica.

---

## 💻 Arquitectura Tecnológica

- **Frontend**: HTML5 Semántico + Tailwind CSS (Diseño oscuro médico anti-reflejo basado en *Functional Clinical Cockpit HUD*).
- **Lógica & Estado**: JavaScript Vanilla reactivo con persistencia local en `localStorage` (a prueba de recargas accidentales de página).
- **Tipografía**: *JetBrains Mono* (cifras tabulares sin desfase visual), *Space Grotesk* (titulares clínicos de alta legibilidad bajo estrés) e *Inter* (registros narrativos).
- **Audio**: Web Audio API (Chimes armónicos y alertas de electromedicina).
- **Despliegue**: Totalmente estático, sin dependencias ni compiladores requeridos. Compatible 100% con **GitHub Pages**.

---

## 🚀 Despliegue en GitHub Pages

Para publicar la aplicación web de forma gratuita y accesible desde cualquier tablet o smartphone en urgencias:

1. Ve a tu repositorio en GitHub: [https://github.com/AnnaYmrp/IA-APP](https://github.com/AnnaYmrp/IA-APP)
2. Haz clic en **Settings** > **Pages** (en el menú lateral izquierdo).
3. En **Build and deployment > Source**, selecciona:
   - Branch: `main`
   - Folder: `/ (root)`
4. Haz clic en **Save**. En 1 minuto tendrás tu enlace activo:
   `https://AnnaYmrp.github.io/IA-APP/`

---

*Desarrollado con base en las Guías AHA ACLS 2020-2025.*
