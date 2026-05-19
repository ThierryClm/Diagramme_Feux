' À lancer UNE SEULE FOIS (double-clic). Crée sur le Bureau un raccourci
' « TraCflux (preview) » qui pointe sur Lancer-preview.vbs.
' Ensuite, tu n'utilises plus que ce raccourci sur le Bureau.
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
desktop = shell.SpecialFolders("Desktop")

Set lnk = shell.CreateShortcut(desktop & "\TraCflux (preview).lnk")
lnk.TargetPath = dir & "\Lancer-preview.vbs"
lnk.WorkingDirectory = dir
lnk.Description = "Lance TraCflux en mode preview (build de production)"
' Icône : on tente icon-512.png si présent, sinon icône système par défaut.
' (Windows préfère un .ico, mais accepte souvent un .png ; sinon icône par défaut.)
If fso.FileExists(dir & "\public\icon.svg") Then
  lnk.IconLocation = dir & "\public\icon.svg"
End If
lnk.Save

MsgBox "Raccourci 'TraCflux (preview)' créé sur le Bureau." & vbCrLf & _
       "Double-clique dessus pour lancer l'application.", 64, "TraCflux"
