' Lance TraCflux en mode PREVIEW (build de production servi localement)
' dans une fenetre Chrome.
'
' Variante Chrome de Lancer-preview.vbs : logique identique, seul le
' chemin de l'executable change.
'
' Logique simple (style "version 1") :
'   1. Ouvre la page d'attente loading-preview.html dans une nouvelle
'      fenetre Chrome.
'   2. En parallele, lance npm run build && npm run preview dans une cmd
'      cachee. La page d'attente sonde localhost:4173 et bascule sur
'      l'app des que pret.

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

' Emplacement de chrome.exe : essai des chemins standards, puis fallback
' sur le registre Windows App Paths si Chrome est dans un dossier
' inattendu.
chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chrome) Then
  chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
End If
If Not fso.FileExists(chrome) Then
  chrome = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & _
           "\Google\Chrome\Application\chrome.exe"
End If
If Not fso.FileExists(chrome) Then
  On Error Resume Next
  Dim regChrome
  regChrome = shell.RegRead("HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
  If regChrome <> "" And fso.FileExists(regChrome) Then chrome = regChrome
  On Error GoTo 0
End If

' URI fichier de la page d'attente : backslashes -> slashes, espaces -> %20
loadingUri = "file:///" & Replace(Replace(dir, "\", "/"), " ", "%20") & "/loading-preview.html"

' Ouvre la page d'attente dans une nouvelle fenetre Chrome
If fso.FileExists(chrome) Then
  shell.Run """" & chrome & """ --new-window """ & loadingUri & """", 1, False
Else
  ' Fallback : navigateur par defaut de Windows
  shell.Run """" & loadingUri & """", 1, False
End If

' Build de production puis serveur preview, en arriere-plan (fenetre cachee).
shell.Run "cmd /c cd /d """ & dir & """ && npm run build && npm run preview", 0, False
