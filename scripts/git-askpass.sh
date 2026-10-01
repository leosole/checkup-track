#!/bin/sh
# Supplies the GitHub PAT to git over https. The token is passed explicitly
# via GH_TOKEN_VAL (set by the wrapper) with GITHUB_TOKEN as fallback.
if [ "$1" = "Username" ]; then
  echo "x-access-token"
elif [ "$1" = "Password" ]; then
  echo "${GH_TOKEN_VAL:-$GITHUB_TOKEN}"
fi
