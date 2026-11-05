; Inno Setup 6 script. Compile on Windows:
;   iscc /DMyAppVersion=0.2.0 game-night-access-adapter.iss

#ifndef MyAppVersion
  #define MyAppVersion "0.2.0"
#endif

[Setup]
AppId={{7C2E9A14-5B18-4E3A-9F01-6D4A2B8C1E70}
AppName=Game Night Access Adapter
AppVersion={#MyAppVersion}
AppVerName=Game Night Access Adapter {#MyAppVersion}
AppPublisher=Game Night
DefaultDirName={autopf}\Game Night Access Adapter
DefaultGroupName=Game Night Access Adapter
DisableProgramGroupPage=yes
OutputDir=..\..\dist\installers
OutputBaseFilename=game-night-access-adapter-{#MyAppVersion}-setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
UninstallDisplayName=Game Night Access Adapter
CloseApplications=force
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\..\access_adapter\*"; DestDir: "{app}\access_adapter"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\requirements.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "python-bootstrap.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "install.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "install.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "post-install.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "register-autostart.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "run-app.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Game Night Access Adapter"; Filename: "{app}\run-app.cmd"
Name: "{group}\Uninstall Game Night Access Adapter"; Filename: "{app}\uninstall.bat"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\post-install.ps1"" -InstallDir ""{app}"""; StatusMsg: "Configuring Game Night Access Adapter..."; Flags: runhidden waituntilterminated

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\uninstall.ps1"" -InstallRoot ""{app}"""; Flags: runhidden waituntilterminated
