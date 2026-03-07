#!/bin/bash
# =============================================================================
# aplicar_solaar_macros.sh
# Configura gestos de mouse en Solaar para Logitech con botones laterales
#
# COMPATIBILIDAD:
#   - Funciona con Solaar instalado via sistema (rpm-ostree, dnf, apt, pacman...)
#     o via Flatpak (io.github.pwr_solaar.solaar)
#   - Detecta automáticamente cuál está instalado
#   - Probado en: Bazzite (rpm-ostree), Fedora, Ubuntu, Arch
#   - Requiere entorno gráfico activo (X11 o Wayland + uinput)
#
# MOUSE SOPORTADO:
#   Logitech Lift (y cualquier ratón con Forward Button, Back Button y DPI Switch)
#   Si tu ratón tiene botones con otros nombres, editá los MouseGesture: [...]
#   Para ver los nombres exactos de tus botones: solaar show
#
# BOTONES Y GESTOS CONFIGURADOS:
#
#   FORWARD BUTTON (botón lateral delantero)
#     click solo          → Ctrl+C  (copiar)
#     + Mouse Up          → Play/Pause
#     + Mouse Right       → l
#     + Mouse Left        → j
#     + Mouse Down        → Ctrl+B
#
#   DPI SWITCH (botón bajo la rueda)
#     click solo          → Click del medio
#     + Mouse Up          → Subir volumen
#     + Mouse Down        → Bajar volumen
#     + Mouse Right       → Ctrl+Tab          (siguiente pestaña)
#     + Mouse Left        → Ctrl+Shift+Tab    (pestaña anterior)
#
#   BACK BUTTON (botón lateral trasero)
#     click solo          → Ctrl+V            (pegar)
#     + Mouse Up          → Ctrl+Shift+T      (restaurar pestaña)
#     + Mouse Right       → Ctrl+T            (nueva pestaña)
#     + Mouse Left        → Ctrl+Shift+P      (barra de comandos)
#     + Mouse Down        → Ctrl+W            (cerrar pestaña)
#
# USO:
#   bash aplicar_solaar_macros.sh
#
# NOTA — por qué hay que correr este script:
#   Solaar guarda la configuración de botones (divert-keys) en config.yaml.
#   Por defecto todos los botones están en modo 0 (comportamiento normal).
#   Los gestos requieren modo 2 (Mouse Gestures). Este script los activa
#   junto con las reglas de rules.yaml.
#   Solaar sobreescribe config al cerrarse, por eso hay que detenerlo primero.
# =============================================================================

set -e

# =============================================================================
# 1. DETECTAR TIPO DE INSTALACIÓN
# =============================================================================
SOLAAR_CMD=""
CONFIG_DIR=""

if command -v solaar &>/dev/null; then
    SOLAAR_CMD="solaar"
    CONFIG_DIR="$HOME/.config/solaar"
    echo "[INFO] Solaar encontrado como paquete del sistema"
elif flatpak list 2>/dev/null | grep -q "io.github.pwr_solaar.solaar"; then
    SOLAAR_CMD="flatpak run io.github.pwr_solaar.solaar"
    CONFIG_DIR="$HOME/.var/app/io.github.pwr_solaar.solaar/config/solaar"
    echo "[INFO] Solaar encontrado como Flatpak"
else
    echo "[ERROR] No se encontró Solaar instalado."
    echo "  Sistema:  sudo dnf install solaar  (Fedora/Bazzite)"
    echo "            sudo apt install solaar  (Ubuntu/Debian)"
    echo "            sudo pacman -S solaar    (Arch)"
    echo "  Flatpak:  flatpak install flathub io.github.pwr_solaar.solaar"
    exit 1
fi

RULES_FILE="$CONFIG_DIR/rules.yaml"
CONFIG_FILE="$CONFIG_DIR/config.yaml"

# =============================================================================
# 2. VERIFICAR PERMISOS DE /dev/uinput
#    Solaar necesita escribir en /dev/uinput para simular teclas/clics.
#    Sin esto las reglas se matchean pero no pasa nada.
# =============================================================================
if [ -e /dev/uinput ] && ! test -w /dev/uinput; then
    echo "[AVISO] Sin permiso de escritura en /dev/uinput."
    echo "        KeyPress y MouseClick no funcionarán hasta resolverlo."
    echo ""
    echo "  Fix TEMPORAL (se pierde al reiniciar):"
    echo "    sudo setfacl -m u:\${USER}:rw /dev/uinput"
    echo ""
    echo "  Fix PERMANENTE (recomendado, requiere reboot):"
    echo "    sudo curl -o /etc/udev/rules.d/42-logitech-unify-permissions.rules \\"
    echo "      https://raw.githubusercontent.com/pwr-Solaar/Solaar/master/rules.d-uinput/42-logitech-unify-permissions.rules"
    echo "    sudo udevadm control --reload-rules"
    echo ""
    read -p "  ¿Aplicar fix temporal ahora? [s/N] " resp
    if [[ "$resp" =~ ^[sS]$ ]]; then
        sudo setfacl -m u:${USER}:rw /dev/uinput && echo "  [OK] Permiso aplicado."
    fi
fi

# =============================================================================
# 3. DETENER SOLAAR
#    Crítico: Solaar sobreescribe config.yaml al cerrarse.
#    Hay que detenerlo ANTES de editar los archivos.
# =============================================================================
echo "[1/4] Deteniendo Solaar..."
if [[ "$SOLAAR_CMD" == flatpak* ]]; then
    flatpak kill io.github.pwr_solaar.solaar 2>/dev/null || true
else
    # Matchea el proceso python que corre solaar, no el nombre del script
    pkill -f "python.*solaar" 2>/dev/null || true
fi
sleep 2

# Forzar cierre si sigue corriendo
if pgrep -f "python.*solaar" &>/dev/null; then
    echo "  Forzando cierre..."
    pkill -9 -f "python.*solaar" 2>/dev/null || true
    sleep 1
fi

mkdir -p "$CONFIG_DIR"

# =============================================================================
# 4. ACTIVAR MOUSE GESTURES EN config.yaml
#
#    divert-keys controla el modo de cada botón por su CID (Control ID):
#      0 = Normal (comportamiento por defecto del sistema operativo)
#      1 = Divertido (notificaciones HID++, matcheable con condición Key:)
#      2 = Mouse Gestures (captura movimiento mientras se mantiene presionado)
#
#    CIDs usados aquí (Logitech Lift — pueden variar en otros modelos):
#      CID 83  (0x53) = Back Button
#      CID 86  (0x56) = Forward Button
#      CID 253 (0xFD) = DPI Switch
#
#    Para encontrar los CIDs de tu ratón: solaar show
#    Los CIDs aparecen en la sección "reprogrammable keys".
# =============================================================================
echo "[2/4] Activando Mouse Gestures en config.yaml..."
if [ -f "$CONFIG_FILE" ]; then
    sed -i \
        -e 's/\(divert-keys:.*\b83:\) 0/\1 2/g' \
        -e 's/\(divert-keys:.*\b86:\) 0/\1 2/g' \
        -e 's/\(divert-keys:.*\b253:\) 0/\1 2/g' \
        "$CONFIG_FILE"
    echo "  divert-keys resultante:"
    grep 'divert-keys' "$CONFIG_FILE" | sed 's/^/  /'
else
    echo "  [AVISO] $CONFIG_FILE no existe todavía."
    echo "  Abre Solaar una vez, cerralo, y volvé a correr este script."
fi

# =============================================================================
# 5. ESCRIBIR rules.yaml
#
#    Formato: un único documento YAML con lista de objetos Rule.
#    Cada Rule contiene primero la condición (MouseGesture) y luego la acción.
#
#    MouseGesture: [Nombre del botón]              → click sin mover
#    MouseGesture: [Nombre del botón, Mouse Dir]   → mantener + mover
#
#    Direcciones disponibles: Mouse Up, Mouse Down, Mouse Left, Mouse Right,
#      Mouse Up-Left, Mouse Up-Right, Mouse Down-Left, Mouse Down-Right
#
#    KeyPress acepta nombres de símbolos X11:
#      letras simples: a, b, l, j, etc.
#      modificadores:  Control_L, Shift_L, Alt_L, Super_L
#      multimedia:     XF86_AudioPlay, XF86_AudioRaiseVolume, XF86_AudioLowerVolume
#      especiales:     Tab, Return, Escape, BackSpace, Delete, space
# =============================================================================
echo "[3/4] Escribiendo reglas en $RULES_FILE..."
cat > "$RULES_FILE" << 'EOF'
%YAML 1.3
---

# ── FORWARD BUTTON ────────────────────────────────────────────────────────────
- Rule:
    - MouseGesture: [Forward Button]          # click solo
    - KeyPress: [Control_L, c]                # → Copiar

- Rule:
    - MouseGesture: [Forward Button, Mouse Up]
    - KeyPress: XF86_AudioPlay                # → Play/Pause

- Rule:
    - MouseGesture: [Forward Button, Mouse Right]
    - KeyPress: l

- Rule:
    - MouseGesture: [Forward Button, Mouse Left]
    - KeyPress: j

- Rule:
    - MouseGesture: [Forward Button, Mouse Down]
    - KeyPress: [Control_L, b]

# ── DPI SWITCH ────────────────────────────────────────────────────────────────
- Rule:
    - MouseGesture: [DPI Switch]              # click solo
    - MouseClick: [middle, click]             # → Click del medio

- Rule:
    - MouseGesture: [DPI Switch, Mouse Up]
    - KeyPress: XF86_AudioRaiseVolume         # → Subir volumen

- Rule:
    - MouseGesture: [DPI Switch, Mouse Down]
    - KeyPress: XF86_AudioLowerVolume         # → Bajar volumen

- Rule:
    - MouseGesture: [DPI Switch, Mouse Right]
    - KeyPress: [Control_L, Tab]              # → Siguiente pestaña

- Rule:
    - MouseGesture: [DPI Switch, Mouse Left]
    - KeyPress: [Control_L, Shift_L, Tab]     # → Pestaña anterior

# ── BACK BUTTON ───────────────────────────────────────────────────────────────
- Rule:
    - MouseGesture: [Back Button]             # click solo
    - KeyPress: [Control_L, v]                # → Pegar

- Rule:
    - MouseGesture: [Back Button, Mouse Up]
    - KeyPress: [Control_L, Shift_L, t]       # → Restaurar pestaña cerrada

- Rule:
    - MouseGesture: [Back Button, Mouse Right]
    - KeyPress: [Control_L, t]                # → Nueva pestaña

- Rule:
    - MouseGesture: [Back Button, Mouse Left]
    - KeyPress: [Control_L, Shift_L, p]       # → Barra de comandos (VSCode/browser)

- Rule:
    - MouseGesture: [Back Button, Mouse Down]
    - KeyPress: [Control_L, w]                # → Cerrar pestaña
EOF

# =============================================================================
# 6. REINICIAR SOLAAR
# =============================================================================
echo "[4/4] Reiniciando Solaar..."
nohup $SOLAAR_CMD --window=hide >/dev/null 2>&1 &
sleep 1

if pgrep -f "python.*solaar" &>/dev/null; then
    echo ""
    echo "✓ Listo. Solaar corriendo con los nuevos gestos."
    echo ""
    echo "  Para verificar en tiempo real (mover botón y ver notificaciones):"
    if [[ "$SOLAAR_CMD" == flatpak* ]]; then
        echo "    flatpak run io.github.pwr_solaar.solaar -ddd"
    else
        echo "    solaar -ddd"
    fi
else
    echo "[AVISO] Solaar no pudo iniciarse. Intentá abrirlo manualmente."
fi