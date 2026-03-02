#!/bin/bash
# Run iOS app with correct encoding and Legacy Architecture
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export RCT_NEW_ARCH_ENABLED=0

cd "$(dirname "$0")"
npx expo run:ios --device "iPhone 17 Pro" "$@"
