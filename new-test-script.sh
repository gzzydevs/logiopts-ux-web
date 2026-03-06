#!/bin/bash

DEVICE="LIFT VERTICAL ERGONOMIC MOUSE"

solaar config "$DEVICE" divert-keys "Back Button" "Diverted"
solaar config "$DEVICE" divert-keys "Forward Button" "Diverted"
solaar config "$DEVICE" divert-keys "DPI Switch" "Diverted"
solaar config "$DEVICE" divert-keys "Middle Button" "Diverted"

echo
echo "Estado:"
solaar show | grep "Key/Button Diversion"