#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

INSTALL_LOCAL=false
for arg in "$@"; do
    case "$arg" in
        --install)
            INSTALL_LOCAL=true
            ;;
        *)
            echo "Unknown argument: $arg" >&2
            echo "Usage: $0 [--install]" >&2
            exit 1
            ;;
    esac
done

echo "==> Validating metadata.json..."
UUID="$(node -e '
import("node:fs").then((fs) => {
    const meta = JSON.parse(fs.readFileSync("./metadata.json", "utf8"));
    const required = ["uuid", "name", "description", "shell-version", "settings-schema", "url"];
    for (const key of required) {
        if (!meta[key] || (Array.isArray(meta[key]) && meta[key].length === 0)) {
            console.error(`Missing or empty required key in metadata.json: ${key}`);
            process.exit(1);
        }
    }
    process.stdout.write(meta.uuid);
});
')"
echo "    Extension UUID: $UUID"

echo "==> Validating GSettings schemas..."
if ! command -v glib-compile-schemas >/dev/null 2>&1; then
    echo "Error: glib-compile-schemas is required but not installed." >&2
    exit 1
fi
glib-compile-schemas --strict schemas/

if ! command -v zip >/dev/null 2>&1; then
    echo "Error: zip is required but not installed." >&2
    exit 1
fi

DIST_DIR="$ROOT_DIR/dist"
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

ARCHIVE_NAME="${UUID}.shell-extension.zip"
ARCHIVE_PATH="${DIST_DIR}/${ARCHIVE_NAME}"

echo "==> Staging extension files for extensions.gnome.org..."
mkdir -p "$DIST_DIR"
mkdir -p "$STAGE_DIR/schemas" "$STAGE_DIR/icons"

# Core extension runtime files
cp extension.js SearchProvider.js prefs.js metadata.json "$STAGE_DIR/"

# GSettings XML schema (extensions.gnome.org compiles schemas on install for GNOME 45+)
cp schemas/*.gschema.xml "$STAGE_DIR/schemas/"

# Symbolic and branding icons
cp icons/*.svg "$STAGE_DIR/icons/"

# Include LICENSE if present
if [[ -f LICENSE ]]; then
    cp LICENSE "$STAGE_DIR/"
fi

rm -f "$ARCHIVE_PATH"
(
    cd "$STAGE_DIR"
    zip -r -9 "$ARCHIVE_PATH" .
)

echo "==> Created package: $ARCHIVE_PATH"
unzip -l "$ARCHIVE_PATH"

if [[ "$INSTALL_LOCAL" == "true" ]]; then
    echo "==> Installing extension locally..."
    if command -v gnome-extensions >/dev/null 2>&1; then
        gnome-extensions install --force "$ARCHIVE_PATH"
        echo "    Installed via gnome-extensions CLI."
    else
        EXT_DEST="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/${UUID}"
        rm -rf "$EXT_DEST"
        mkdir -p "$EXT_DEST"
        unzip -q "$ARCHIVE_PATH" -d "$EXT_DEST"
        glib-compile-schemas "$EXT_DEST/schemas/"
        echo "    Installed to $EXT_DEST (schemas compiled)."
    fi
fi
