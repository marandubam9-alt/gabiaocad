// Ajusta ícone e informações do .exe sem precisar do Windows (substitui o rcedit)
const fs = require('fs');
const path = require('path');
exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const R = ResEdit.default || ResEdit;
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const data = fs.readFileSync(exe);
  const pe = R.NtExecutable.from(data, { ignoreCert: true });
  const res = R.NtExecutableResource.from(pe);
  const iconFile = R.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'build', 'icon.ico')));
  R.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, iconFile.icons.map(i => i.data));
  const vi = R.Resource.VersionInfo.fromEntries(res.entries)[0];
  const ver = context.packager.appInfo.version.split('.').map(Number);
  vi.setFileVersion(ver[0], ver[1], ver[2], 0, 1033);
  vi.setProductVersion(ver[0], ver[1], ver[2], 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'GabiãoCAD', ProductName: 'GabiãoCAD', CompanyName: 'GabiãoCAD',
    OriginalFilename: 'GabiaoCAD.exe', InternalName: 'GabiaoCAD', LegalCopyright: '',
  });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(pe);
  fs.writeFileSync(exe, Buffer.from(pe.generate()));
  console.log('  • ícone e versão aplicados em', path.basename(exe));
};
