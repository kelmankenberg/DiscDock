# Packaging & Deployment

## 1. Build Tooling

- **electron-builder** as the single packaging tool, configured to produce both target formats from one build.
- Targets (Linux): `deb`, `AppImage`.

## 2. Example `electron-builder` Configuration (`electron-builder.yml`)

```yaml
appId: com.discdock.app
productName: DiscDock
directories:
  output: release
files:
  - dist/**
  - package.json
linux:
  category: Utility
  icon: build/icon.png
  target:
    - target: deb
      arch: [x64]
    - target: AppImage
      arch: [x64]
  desktop:
    Name: DiscDock
    Comment: Catalog and search your external media collection
    Categories: Utility;FileTools;
deb:
  depends:
    - libnotify4
    - libnss3
    - libxss1
    - libgtk-3-0
  packageCategory: utils
appImage:
  license: LICENSE.txt
```

Adjust `deb.depends` to match the actual Electron version's bundled Chromium runtime dependencies at implementation time.

## 3. Application Data Locations (Linux, XDG)

| Purpose | Path |
|---|---|
| SQLite database | `~/.local/share/DiscDock/discdock.sqlite3` |
| Configuration/settings | `~/.config/DiscDock/settings.json` |
| Logs | `~/.local/share/DiscDock/logs/` |
| Automatic pre-restore/pre-migration safety backups | `~/.local/share/DiscDock/backups/` |

These follow the `XDG_DATA_HOME` / `XDG_CONFIG_HOME` conventions (falling back to the defaults above when unset), consistent with Electron's default `app.getPath()` behavior on Linux.

## 4. Release Pipeline (CI)

1. Checkout + install dependencies (`npm ci`).
2. Lint (`eslint`) and type-check (`tsc --noEmit`).
3. Run unit/integration test suite.
4. Build renderer (Vite) and compile main/preload (TypeScript).
5. Run `electron-builder` to produce `.deb` and `.AppImage` artifacts.
6. Smoke test: install `.deb` in a clean container image (`dpkg -i` + launch headless check); run `.AppImage` with `--appimage-extract-and-run` and verify it starts and quits cleanly.
7. Publish artifacts (GitHub Releases or internal artifact store) tagged with version.

## 5. Versioning

- Semantic versioning (`MAJOR.MINOR.PATCH`).
- Database schema version tracked independently in a `schema_migrations` table; app checks and applies pending migrations on startup before the UI becomes interactive, showing a brief "Preparing database..." splash if migrations are needed.

## 6. Update Strategy (v1)

- No auto-update service in v1 (avoids added complexity/attack surface for a local-data tool). Users are notified in-app if a newer release is detected via a lightweight, optional "check for updates" call to a static release-metadata endpoint (opt-in, respecting NFR-5.1 no-background-network-calls-by-default principle). This can be upgraded to `electron-updater` in a later phase if desired.

## 7. Distribution QA Checklist

- [ ] `.deb` installs cleanly on a current Ubuntu LTS image without missing dependency errors.
- [ ] `.deb` registers a working desktop menu entry and icon.
- [ ] `.AppImage` runs on at least one non-Debian-based distro (e.g., Fedora) with FUSE available.
- [ ] `.AppImage` documented fallback (`--appimage-extract-and-run`) verified on a distro without FUSE.
- [ ] Application data directories created correctly on first run for both package types.
- [ ] Uninstalling the `.deb` does not delete user data directories (data persists per XDG norms unless the user explicitly resets).
