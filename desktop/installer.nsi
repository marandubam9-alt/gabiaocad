Unicode true
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define APPNAME "GabiãoCAD"
!define EXENAME "GabiaoCAD.exe"
!define REGKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\GabiaoCAD"
!ifndef VERSION
  !define VERSION "0.1.0"
!endif

Name "${APPNAME}"
OutFile "dist\GabiaoCAD-Setup-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\GabiaoCAD"
InstallDirRegKey HKCU "Software\GabiaoCAD" "InstallDir"
RequestExecutionLevel user
BrandingText "${APPNAME} ${VERSION}"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1046 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=1046 "FileDescription" "Instalador do ${APPNAME}"
VIAddVersionKey /LANG=1046 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1046 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1046 "LegalCopyright" ""

!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Instalar o ${APPNAME}"
!define MUI_WELCOMEPAGE_TEXT "Programa para projetar e verificar muros de gabião: corte, vista, 3D, estabilidade, chuva, leito de rio e quantitativos.$\r$\n$\r$\nFunciona sem internet. Não precisa de permissão de administrador.$\r$\n$\r$\nClique em Avançar para continuar."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o ${APPNAME} agora"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

Section "Programa" SecMain
  SetShellVarContext current
  ; fecha o programa se estiver aberto
  nsExec::Exec 'taskkill /F /IM "${EXENAME}"'
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "dist\win-unpacked\*.*"
  File "build\icon.ico"
  WriteUninstaller "$INSTDIR\Desinstalar GabiaoCAD.exe"

  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  CreateShortCut "$SMPROGRAMS\${APPNAME}\Desinstalar ${APPNAME}.lnk" "$INSTDIR\Desinstalar GabiaoCAD.exe"

  ; arquivos .gabiao abrem no programa
  WriteRegStr HKCU "Software\Classes\.gabiao" "" "GabiaoCAD.Projeto"
  WriteRegStr HKCU "Software\Classes\GabiaoCAD.Projeto" "" "Projeto GabiãoCAD"
  WriteRegStr HKCU "Software\Classes\GabiaoCAD.Projeto\DefaultIcon" "" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "Software\Classes\GabiaoCAD.Projeto\shell\open\command" "" '"$INSTDIR\${EXENAME}" "%1"'
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'

  ; aparece em "Aplicativos instalados" do Windows
  WriteRegStr HKCU "Software\GabiaoCAD" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${REGKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${REGKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${REGKEY}" "Publisher" "${APPNAME}"
  WriteRegStr HKCU "${REGKEY}" "DisplayIcon" "$INSTDIR\${EXENAME}"
  WriteRegStr HKCU "${REGKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${REGKEY}" "UninstallString" '"$INSTDIR\Desinstalar GabiaoCAD.exe"'
  WriteRegDWORD HKCU "${REGKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${REGKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "${REGKEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::Exec 'taskkill /F /IM "${EXENAME}"'
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Classes\GabiaoCAD.Projeto"
  DeleteRegValue HKCU "Software\Classes\.gabiao" ""
  DeleteRegKey /ifempty HKCU "Software\Classes\.gabiao"
  DeleteRegKey HKCU "${REGKEY}"
  DeleteRegKey HKCU "Software\GabiaoCAD"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
SectionEnd
