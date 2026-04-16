Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
' Ouvrir la page de chargement dans le navigateur
shell.Run """" & dir & "\loading.html""", 1, False
' Demarrer Vite en arriere-plan (fenetre cachee)
shell.Run "cmd /c cd /d """ & dir & """ && npx vite --port 3000", 0, False
