' Lance TraCflux en mode PREVIEW (build de production servi localement),
' dans une fenetre Edge en mode APPLICATION (sans barre d'adresse ni
' onglets). Ouvre la page d'attente, compile l'app, demarre le serveur
' preview (port 4173) ; la page d'attente redirige automatiquement.
'
' Avant d'ouvrir la page d'attente, on injecte les 3 derniers sujets de
' commit (+ "..." s'il y en a plus) pour faire patienter et montrer que
' l'application evolue. Si git est indisponible, le bloc est simplement
' omis. Fichier ASCII volontairement (les .vbs sont lus en ANSI) : les
' accents passent par des entites HTML ou par les sorties git en UTF-8.

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

template = dir & "\loading-preview.html"
genFile  = dir & "\.loading-preview.gen.html"
tmpLog   = dir & "\.gitlog.tmp"
tmpCnt   = dir & "\.gitcount.tmp"

' --- Recupere les sujets de commit en UTF-8 (redirection fichier) ---
On Error Resume Next
shell.Run "cmd /c chcp 65001>nul & git -C """ & dir & """ log -3 --format=%s 1> """ & tmpLog & """ 2>nul", 0, True
shell.Run "cmd /c git -C """ & dir & """ rev-list --count HEAD 1> """ & tmpCnt & """ 2>nul", 0, True
On Error GoTo 0

subjects = ""
total = 0
If fso.FileExists(tmpLog) Then subjects = ReadUtf8(tmpLog)
If fso.FileExists(tmpCnt) Then total = CLng("0" & Trim(ReadAscii(tmpCnt)))

' --- Construit le bloc HTML (vide si pas de git) ---
block = ""
items = ""
shown = 0
If Len(Trim(subjects)) > 0 Then
  arr = Split(Replace(subjects, vbCr, ""), vbLf)
  For i = 0 To UBound(arr)
    line = Trim(arr(i))
    If Len(line) > 0 And shown < 3 Then
      items = items & "<li>" & EscHtml(line) & "</li>"
      shown = shown + 1
    End If
  Next
  If total > shown Then items = items & "<li class=""more"">&#8230;</li>"
  If Len(items) > 0 Then
    block = "<div class=""changelog"">" & _
            "<div class=""changelog-title"">Nouveaut&#233;s de ce build</div>" & _
            "<ul>" & items & "</ul></div>"
  End If
End If

' --- Genere la page d'attente a partir du gabarit ---
html = ReadUtf8(template)
html = Replace(html, "<!--CHANGELOG-->", block)
WriteUtf8 genFile, html

' Nettoyage des fichiers temporaires git
On Error Resume Next
If fso.FileExists(tmpLog) Then fso.DeleteFile tmpLog
If fso.FileExists(tmpCnt) Then fso.DeleteFile tmpCnt
On Error GoTo 0

' Emplacement de msedge.exe (deux chemins possibles selon l'install)
edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edge) Then
  edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
End If

' URI fichier de la page generee : backslashes -> slashes, espaces -> %20
loadingUri = "file:///" & Replace(Replace(genFile, "\", "/"), " ", "%20")

If fso.FileExists(edge) Then
  ' Fenetre Edge en mode application : pas de barre d'adresse, pas d'onglets.
  ' --start-maximized : la fenetre occupe tout l'ecran (barre de titre
  ' conservee). Chromium ignorant le flag de style WScript.Shell.Run, on
  ' passe par cette option de ligne de commande.
  shell.Run """" & edge & """ --app=""" & loadingUri & """ --start-maximized", 1, False
Else
  ' Repli si Edge introuvable : navigateur par defaut (onglet classique)
  shell.Run """" & genFile & """", 1, False
End If

' Build de production puis serveur preview (fenetre cachee, reste actif)
shell.Run "cmd /c cd /d """ & dir & """ && npm run build && npm run preview", 0, False

' ---------- Fonctions utilitaires ----------

Function ReadUtf8(path)
  Dim st: Set st = CreateObject("ADODB.Stream")
  st.Type = 2 : st.Charset = "utf-8" : st.Open
  st.LoadFromFile path
  ReadUtf8 = st.ReadText(-1)
  st.Close
End Function

Function ReadAscii(path)
  Dim f, s
  Set f = fso.OpenTextFile(path, 1, False)
  If Not f.AtEndOfStream Then s = f.ReadAll Else s = ""
  f.Close
  ReadAscii = s
End Function

Sub WriteUtf8(path, text)
  Dim st: Set st = CreateObject("ADODB.Stream")
  st.Type = 2 : st.Charset = "utf-8" : st.Open
  st.WriteText text
  st.SaveToFile path, 2
  st.Close
End Sub

Function EscHtml(s)
  s = Replace(s, "&", "&amp;")
  s = Replace(s, "<", "&lt;")
  s = Replace(s, ">", "&gt;")
  s = Replace(s, """", "&quot;")
  EscHtml = s
End Function
