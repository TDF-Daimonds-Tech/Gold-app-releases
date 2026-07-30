#!/usr/bin/env bash
# One-time bootstrap of the Android signing key for a Bubblewrap app.
#
# Creates the keystore, prints the certificate SHA-256 fingerprint, writes the
# matching .well-known/assetlinks.json, and prints the `gh secret set` commands
# the "Android APK (TWA)" workflow needs.
#
# Run this ONCE per app and keep the keystore forever: Android refuses to update
# an installed app that was signed with a different key.
#
# Usage: android/scripts/create-keystore.sh [app-id]
set -euo pipefail

app_id="${1:-tms}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
out_dir="$repo_root/.keys"

app=$(jq -c --arg id "$app_id" '.[] | select(.id == $id)' "$repo_root/android/apps.json")
if [ -z "$app" ]; then
  echo "No app with id '$app_id' in android/apps.json" >&2
  exit 1
fi

app_dir=$(printf '%s' "$app" | jq -r '.dir')
package_id=$(printf '%s' "$app" | jq -r '.packageId')
display_name=$(printf '%s' "$app" | jq -r '.displayName')
manifest_url=$(printf '%s' "$app" | jq -r '.manifestUrl')
alias_name=$(jq -r '.signingKey.alias' "$repo_root/$app_dir/twa-manifest.json")

keytool="keytool"
if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/keytool" ]; then
  keytool="$JAVA_HOME/bin/keytool"
elif ! command -v keytool > /dev/null; then
  echo "keytool not found. Install a JDK 17 or set JAVA_HOME." >&2
  exit 1
fi

mkdir -p "$out_dir"
keystore="$out_dir/$app_id.keystore"
if [ -e "$keystore" ]; then
  echo "$keystore already exists. Delete it only if you are certain no released build was signed with it." >&2
  exit 1
fi

password=$(openssl rand -hex 16)

echo "Creating keystore for $package_id (alias: $alias_name)"
"$keytool" -genkeypair -keystore "$keystore" -alias "$alias_name" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$password" -keypass "$password" \
  -dname "CN=$display_name, O=TDF Jewellery, C=IN"

# No `exit` in awk: under pipefail an early exit can SIGPIPE keytool.
fingerprint=$("$keytool" -list -v -keystore "$keystore" -alias "$alias_name" \
  -storepass "$password" | awk '/SHA256:/ && !seen {print $2; seen=1}')

base64_file="$out_dir/$app_id.keystore.base64"
base64 -w0 "$keystore" > "$base64_file" 2> /dev/null || base64 "$keystore" | tr -d '\n' > "$base64_file"

assetlinks_file="$out_dir/$app_id-assetlinks.json"
jq -n --arg pkg "$package_id" --arg fp "$fingerprint" '[{
  relation: ["delegate_permission/common.handle_all_urls"],
  target: {namespace: "android_app", package_name: $pkg, sha256_cert_fingerprints: [$fp]}
}]' > "$assetlinks_file"

host=$(printf '%s' "$manifest_url" | awk -F/ '{print $3}')

cat <<EOF

Keystore created.
  keystore    : $keystore
  password    : $password
  base64      : $base64_file
  assetlinks  : $assetlinks_file
  SHA-256     : $fingerprint

1) Back up the keystore + password somewhere permanent (password manager).
   Losing them means you can never ship an update to installed apps.

2) Add the repository secrets:
   gh secret set $(printf '%s' "$app" | jq -r '.keystoreSecret') < "$base64_file"
   gh secret set $(printf '%s' "$app" | jq -r '.keystorePasswordSecret') --body "$password"
   gh secret set $(printf '%s' "$app" | jq -r '.keyPasswordSecret') --body "$password"

3) Serve the assetlinks file at https://$host/.well-known/assetlinks.json
   (Next.js: copy it to public/.well-known/assetlinks.json and redeploy).
   Without it the app still works, but Chrome shows a URL bar at the top.
EOF
