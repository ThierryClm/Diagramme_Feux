' Lance TraCflux en mode PREVIEW (build de production servi localement)
' dans une fenetre Edge.
'
' Logique simple (style "version 1") :
'   1. Ouvre la page d'attente loading-preview.html dans une nouvelle
'      fenetre Edge -> retour visuel immediat pour l'utilisateur.
'   2. En parallele, lance npm run build && npm run preview dans une cmd
'      cachee. La page d'attente sonde localhost:4173 toutes les secondes
'      et bascule automatiquement sur l'app des que le serveur repond.
'
' Pas de verrou, pas de profil isole, pas de logique d'idempotence.
' Si l'utilisateur double-clique, deux pages d'attente s'ouvrent ; la
' 2e cmd cachee tente aussi de lancer un serveur mais 4173 sera deja
' occupe -> elle meurt silencieusement, et les deux pages d'attente
' basculent ensemble sur le serveur du premier clic.

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

' Ouvre la page d'attente dans une nouvelle fenetre Edge
If fso.FileExists(edge) Then
  shell.Run """" & edge & """ --new-window """ & loadingUri & """", 1, False
Else
  ' Fallback : navigateur par defaut de Windows
  shell.Run """" & loadingUri & """", 1, False
End If

' Build de production puis serveur preview, en arriere-plan (fenetre cachee).
' La page d'attente bascule sur localhost:4173 des que ca repond.
shell.Run "cmd /c cd /d """ & dir & """ && npm run build && npm run preview", 0, False
