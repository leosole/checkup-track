#!/bin/sh
# Supplies the GitHub PAT from the environment to git over https.
if [ "$1" = "Username" ]; then
  echo "x-access-token"
elif [ "$1" = "Password" ]; then
  echo "$GITHUB_TOKEN"
fi
