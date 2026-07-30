# Android APKs from the PWAs (Bubblewrap / TWA)

Each app here is a [Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity):
a thin Android shell that opens the real website full-screen in Chrome. There is
no separate app codebase — whatever ships to the site ships to the app.

Builds run in CI, not on anybody's laptop:
[`.github/workflows/android-twa.yml`](../.github/workflows/android-twa.yml) →
`app-release-signed.apk` + `app-release-bundle.aab` → GitHub Release.

| App id | Package | Site | Release tag |
|---|---|---|---|
| `tms` | `com.tdfjewellery.tasks` | https://app.tdfjewellery.com | `tms-v<version>` |

The website's install button (`index.html`) reads the newest `tms-v*` release of
this repo through the GitHub API, so publishing a release is all it takes to ship
a new build.

---

## One-time setup

### 1. Create the signing key

Android identifies an app by package id **plus signing certificate**. Sign every
release with the same key or installed apps can never be updated.

```powershell
./android/scripts/create-keystore.ps1 -AppId tms
```

(or `android/scripts/create-keystore.sh tms` in Git Bash)

It writes everything to the git-ignored `.keys/` folder and prints:

- the keystore and its password — **back both up in a password manager**
- the three `gh secret set` commands to run
- `.keys/tms-assetlinks.json`

### 2. Add the repository secrets

From the output of step 1:

```powershell
gh secret set TMS_ANDROID_KEYSTORE_BASE64 < .keys/tms.keystore.base64
gh secret set TMS_ANDROID_KEYSTORE_PASSWORD --body "<password>"
gh secret set TMS_ANDROID_KEY_PASSWORD --body "<password>"
```

`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_PASSWORD`
work as a shared fallback for every app that has no app-specific secret.

### 3. Publish `assetlinks.json` on the site

Digital Asset Links is what proves the app and the domain belong to each other.
Until `https://app.tdfjewellery.com/.well-known/assetlinks.json` returns the file
(it currently 404s), the app **works but shows a Chrome URL bar** across the top.

The site is a Next.js app, so copy the generated file to
`public/.well-known/assetlinks.json` in that repository and redeploy. Verify:

```powershell
curl https://app.tdfjewellery.com/.well-known/assetlinks.json
```

Every build also attaches its own `assetlinks.json` to the GitHub Release, so the
fingerprint is never a mystery.

---

## Publishing a build

**From the Actions tab** — run *Android APK (TWA)*:

| Input | Meaning |
|---|---|
| `app` | `all`, or a single app id such as `tms` |
| `version_name` | e.g. `1.2.0`. Blank → `<versionNameBase>.<run number>` (`1.0.37`) |
| `prerelease` | mark the GitHub Release as a pre-release |
| `dry_run` | build and upload artifacts only, no Release |

**From a tag** — pushing `tms-v1.2.0` builds `tms` at version `1.2.0` and
publishes the release:

```powershell
git tag tms-v1.2.0; git push origin tms-v1.2.0
```

`versionCode` is `github.run_number + versionCodeOffset`, so it only ever goes up.
If you ever need to reset the numbering (new Play track, restarted repo), raise
`versionCodeOffset` in `apps.json` — never lower it.

### Play Store

Upload the `.aab` from the release to the Play Console. Play re-signs with its own
app-signing key, so after the first upload you must add **Play's** SHA-256
fingerprint to `assetlinks.json` as well (Play Console → Setup → App signing).
`assetlinks.json` accepts multiple fingerprints in the array.

---

## Adding another app

1. Generate the TWA manifest from the live web manifest — no interactive prompts:

   ```powershell
   mkdir android/<id>
   npx --yes -p @bubblewrap/core node -e "const {TwaManifest}=require('@bubblewrap/core');const u=new URL('https://<host>/manifest.json');fetch(u).then(r=>r.json()).then(async w=>{const m=TwaManifest.fromWebManifestJson(u,w);m.packageId='com.tdfjewellery.<id>';m.signingKey={path:'./android.keystore',alias:'android'};m.appVersionName='1.0.0';m.appVersionCode=1;const e=m.validate();if(e)throw e;await m.saveToFile('android/<id>/twa-manifest.json')})"
   ```

   (Or run `bubblewrap init --manifest=https://<host>/manifest.json` locally and
   copy the resulting `twa-manifest.json` in — CI only needs that one file.)

2. Add an entry to [`apps.json`](apps.json) copying the `tms` block.
3. Add `'<id>-v*'` to the workflow's `push.tags` list.
4. Repeat the one-time setup above with `-AppId <id>`.

## Requirements the site must meet

- HTTPS, and a web manifest with `name`, `start_url`, and 192px + 512px icons ✔
- A service worker (`https://app.tdfjewellery.com/sw.js` ✔ — the workflow passes
  `--skipPwaValidation` so a failed Lighthouse check never blocks a build)
- `/.well-known/assetlinks.json` — see step 3 above

## What CI pins, and why

The Bubblewrap toolchain is fussy about exact versions; the workflow pins them
rather than letting them drift:

- **Bubblewrap 1.24.1** — the committed `twa-manifest.json` matches this schema.
- **JDK 17** — Bubblewrap hard-checks for `JAVA_VERSION="17.0…"`.
- **build-tools 34.0.0** — Bubblewrap shells out to exactly this `zipalign` and
  `apksigner`; 35/36 are installed for the Android Gradle Plugin.
- **platforms;android-36** — what the generated project compiles against.

Two workarounds also live in the workflow: a `bin` symlink at the SDK root
(Bubblewrap rejects the runner's SDK layout otherwise) and rewriting the dead
`jcenter()` repository in the generated Gradle files to `mavenCentral()`.

## Local build (optional)

```powershell
npm install -g @bubblewrap/cli
bubblewrap doctor                       # downloads/configures JDK + SDK on first run
mkdir android-twa; cd android-twa
copy ..\android\tms\twa-manifest.json .
copy ..\.keys\tms.keystore .\android.keystore
bubblewrap update --skipVersionUpgrade  # regenerates the Android project
bubblewrap build --skipPwaValidation    # -> app-release-signed.apk, app-release-bundle.aab
```

Never commit `android.keystore`, `*.base64`, or the `.keys/` folder.
