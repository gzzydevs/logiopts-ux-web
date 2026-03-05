#!/bin/bash
# Script para aplicar las reglas de Solaar correctamente
# Detiene Solaar de manera segura para que no sobreescriba nuestra config
echo "Deteniendo Solaar..."
flatpak kill io.github.pwr_solaar.solaar
sleep 2

# Verificamos si realmente se detuvo
if flatpak ps | grep -q io.github.pwr_solaar.solaar; then
    echo "Solaar no se detuvo, forzando cierre..."
    flatpak kill io.github.pwr_solaar.solaar
    sleep 1
fi

CONFIG_DIR="$HOME/.var/app/io.github.pwr_solaar.solaar/config/solaar"
RULES_FILE="$CONFIG_DIR/rules.yaml"

echo "Escribiendo nuevas reglas corregidas en $RULES_FILE..."
cat > "$RULES_FILE" << 'EOF'
%YAML 1.3
---
# === FORWARD BUTTON ===
- MouseGesture: [Forward Button]
- KeyPress: [Control_L, c]
...
---
- MouseGesture: [Forward Button, Mouse Up]
- KeyPress: XF86_AudioPlay
...
---
- MouseGesture: [Forward Button, Mouse Right]
- KeyPress: [Super_L, Shift_L, Right]
...
---
- MouseGesture: [Forward Button, Mouse Left]
- KeyPress: [Super_L, Shift_L, Left]
...
---
- MouseGesture: [Forward Button, Mouse Down]
- KeyPress: [Control_L, b]
...
---
# === DPI SWITCH ===
- MouseGesture: [DPI Switch]
- MouseClick: [middle, click]
...
---
- MouseGesture: [DPI Switch, Mouse Up]
- KeyPress: XF86_AudioRaiseVolume
...
---
- MouseGesture: [DPI Switch, Mouse Down]
- KeyPress: XF86_AudioLowerVolume
...
---
- MouseGesture: [DPI Switch, Mouse Right]
- KeyPress: [Control_L, Tab]
...
---
- MouseGesture: [DPI Switch, Mouse Left]
- KeyPress: [Control_L, Shift_L, Tab]
...
---
# === BACK BUTTON ===
- MouseGesture: [Back Button]
- KeyPress: [Control_L, v]
...
---
- MouseGesture: [Back Button, Mouse Up]
- KeyPress: [Control_L, Shift_L, t]
...
---
- MouseGesture: [Back Button, Mouse Right]
- KeyPress: [Control_L, t]
...
---
- MouseGesture: [Back Button, Mouse Left]
- KeyPress: [Control_L, Shift_L, p]
...
---
- MouseGesture: [Back Button, Mouse Down]
- KeyPress: [Control_L, w]
...
EOF

echo "Reiniciando Solaar..."
nohup flatpak run io.github.pwr_solaar.solaar --window=hide > /dev/null 2>&1 &
echo "¡Listo! Los gestos con los botones deberían funcionar correctamente."
