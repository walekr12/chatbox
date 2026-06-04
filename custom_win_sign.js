exports.default = async function signWindowsBuild() {
  // Community builds are unsigned. Electron Builder requires this file because
  // electron-builder.yml references it for official release signing.
}
