#!/bin/bash
# shellcheck disable=SC2045
checkPython() {
  V=2

  U_V=$(python -V 2>&1 | awk '{print $2}' | awk -F '.' '{print $1}')

  if [ "$U_V" -lt $V ]; then
    echo Your python version should be Python $V
    exit 1
  fi
  echo Your python version is OK
}

checkADB() {
  devices=$(adb devices | awk '{print $1}')
  # shellcheck disable=SC2206
  devices=(${devices//' '/ })
  len=${#devices[*]}-1
  if (("$len" <= 0)); then
    echo Please confirm that you have connected your phone to this PC and installed ADB tool
    exit 1
  fi
  if (("$len" >= 2)); then
    echo Multiple devices or emulators detected, please comfirm that only one device is connected
    exit 1
  fi

  echo Device "${devices[1]}" connected
}

main() {
  checkPython
  checkADB

  echo "We will first check the initialization status of all apps used for benchmarking."
  read -r -p "If you are sure that the apps are properly initialized, input N to skip. Else press ENTER..." choice
  if [ "$choice" != "N" ] && [ "$choice" != "n" ]; then
    python prepare.py
  fi
  device="$(adb shell getprop ro.product.model)"
  device=${device//" "/""}

  data_dir=data
  if [ ! -d "$data_dir" ]; then
    mkdir $data_dir
  fi

  for idx in {1..10}; do
    echo "--------------------------------"
    echo Benchmark round "$idx"/10
    python systrace.py -o ./traces/trace.html
    trace_zip=trace-"$device"-"$idx".zip
    zip -r "$trace_zip" traces
    mv "$trace_zip" "$data_dir"
    sleep 3m
  done
}

main
