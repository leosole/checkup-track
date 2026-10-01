#!/bin/sh
# Supplies the GitHub PAT to git over https. The token is passed explicitly
# via GH_TOKEN_VAL (set by the wrapper) with GITHUB_TOKEN as fallback.
# git passes the full prompt string as $1, so match on prefixes.
case "$1" in
  Username*)
    echo "leosole"
    ;;
  Password*)
    echo "${GH_TOKEN_VAL:-$GITHUB_TOKEN}"
    ;;
esac
