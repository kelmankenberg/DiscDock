# AUR package

`discdock` is packaged as a binary AUR package using the Arch `.pacman` artifact
from the matching GitHub Release. That artifact is an intermediate payload;
`makepkg` repackages it into a clean `.pkg.tar.zst` with correct ownership
metadata. It supports x86_64 and declares the runtime dependencies needed by
the Electron bundle. Device safe-removal and audio-CD utilities are optional.
`util-linux` supplies the `lsblk` and `eject` commands.

## Publishing a release

1. Complete the release-readiness checklist and build the Arch package on Arch:
   `npm run package:arch`.
2. Upload the exact `release/discdock-${pkgver}.pacman` artifact to the matching
   GitHub Release as `discdock-${pkgver}.pacman`.
3. Set `pkgver` and the artifact's SHA-256 in `PKGBUILD`, then regenerate
   `.SRCINFO` with `makepkg --printsrcinfo > .SRCINFO`.
4. Push `PKGBUILD`, `discdock.install`, and `.SRCINFO` to the AUR Git repository
   for `discdock`.

The checksum in the AUR recipe must match the artifact uploaded to the release.
Do not use `SKIP` for the binary artifact.
