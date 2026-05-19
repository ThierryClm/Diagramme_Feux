' Lance TraCflux en mode PREVIEW (build de production servi localement),
' dans une fenetre Edge en mode APPLICATION (sans barre d'adresse ni
' onglets). Ouvre la page d'attente, compile l'app, demarre le serveur
' preview (port 4173) ; la page d'attente redirige automatiquement.
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

' Emplacement de msedge.exe (deux chemins possibles selon l'install)
edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edge) Then
  edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
End If

' URI fichier de la page d'attente : backslashes -> slashes, espaces -> %20
loadingUri = "file:///" & Replace(Replace(dir, "\", "/"), " ", "%20") & "/loading-preview.html"

If fso.FileExists(edge) Then
  ' Fenetre Edge en mode application : pas de barre d'adresse, pas d'onglets
  shell.Run """" & edge & """ --app=""" & loadingUri & """", 1, False
Else
  ' Repli si Edge introuvable : navigateur par defaut (onglet classique)
  shell.Run """" & dir & "\loading-preview.html""", 1, False
End If

' Build de production puis serveur preview (fenetre cachee, reste actif)
shell.Run "cmd /c cd /d """ & dir & """ && npm run build && npm run preview", 0, False
