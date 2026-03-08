#!/bin/bash
# Turn off night shift — reset gamma on all monitors
pkill gammastep 2>/dev/null
for output in $(DISPLAY=:0 xrandr --listactivemonitors | awk 'NR>1{print $NF}'); do
    DISPLAY=:0 xrandr --output "$output" --gamma 1:1:1
done
echo 6500 > /tmp/logitux-nightshift-temp
