#!/bin/bash
# shellcheck disable=SC2045
for file in $(ls ../systrace/data)
do
  pwd=$(pwd)
  if [[ $file == *.zip ]]
  then
    cd ../systrace/data || exit
    rm -r "traces" || echo
    unzip "$file"
    cd "$pwd" || exit
    name_len=$(expr length "$file")
    name=${file:0:name_len-4}
    name="$name".json
    node --max-old-space-size=10000 analyzer.js ../systrace/data/traces "$name"
  fi
done
