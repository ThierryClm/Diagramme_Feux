' Lance TraCflux en mode PREVIEW (build de production servi localement),
' dans une fenetre Edge en mode APPLICATION (sans barre d'adresse ni
' onglets), maximisee.
'
' LANCEUR IDEMPOTENT (corrige le plantage des lancements repetes) :
'   1. Serveur deja en ligne sur 4173  -> ouvre juste une fenetre dessus,
'                                          aucun rebuild (instantane).
'   2. Build deja en cours (verrou recent) -> ouvre la page d'attente
'                                          (elle poll 4173), sans relancer
'                                          de build.
'   3. Premier lancement -> pose un verrou, page d'attente, puis
'                                          npm run build && npm run preview.
' Sans cette cascade, chaque double-clic relancait un build concurrent
' ecrivant dans le meme dist/ pendant qu'un preview le servait : course
' -> page corrompue / plantage au bout de quelques lancements.
'
' La page d'attente affiche les 3 derniers sujets de commit (+ "..."
' s'il y en a plus). Fichier ASCII volontairement (les .vbs sont lus en
' ANSI) : les accents passent par des entites HTML ou les sorties git UTF-8.

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

template   = dir & "\loading-preview.html"
genFile    = dir & "\.loading-preview.gen.html"
tmpLog     = dir & "\.gitlog.tmp"
tmpCnt     = dir & "\.gitcount.tmp"
lockFile   = dir & "\.preview.lock"
previewUrl = "http://localhost:4173"
LOCK_TTL   = 180   ' secondes : au-dela, un verrou est considere perime

' Emplacement de msedge.exe (deux chemins possibles selon l'install)
edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edge) Then
  edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
End If

' ---- Branche 1 : un serveur preview repond deja -> fenetre directe ----
If IsPreviewUp(previewUrl) Then
  OpenWindow previewUrl
  WScript.Quit
End If

' ---- Branche 2 : un build est deja en cours (verrou frais) ----
' On montre la page d'attente (elle basculera quand ce build aura fini)
' mais on NE relance PAS de build.
If LockIsFresh(lockFile, LOCK_TTL) Then
  BuildLoadingPage
  OpenWindow "file:///" & Replace(Replace(genFile, "\", "/"), " ", "%20")
  WScript.Quit
End If

' ---- Branche 3 : premier lancement -> verrou + attente + build ----
WriteLock lockFile
BuildLoadingPage
OpenWindow "file:///" & Replace(Replace(genFile, "\", "/"), " ", "%20")

' build puis, le verrou retire, le serveur preview (fenetre cachee). Le
' verrou est efface juste avant preview : les lancements suivants pendant
' le service basculent en branche 1. S'il echoue, le verrou perime tout
' seul apres LOCK_TTL (branche 3 reessaiera).
shell.Run "cmd /c cd /d """ & dir & """ && npm run build && ( del /f /q """ & lockFile & """ 2>nul & npm run preview )", 0, False

' ===================== Procedures / fonctions =====================

' Vrai si quelque chose repond en HTTP sur l'URL (serveur preview up).
Function IsPreviewUp(url)
  Dim http, ok
  ok = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  If http Is Nothing Then Set http = CreateObject("MSXML2.ServerXMLHTTP")
  http.setTimeouts 1000, 1000, 1000, 2000
  http.open "GET", url, False
  http.send
  If Err.Number = 0 Then
    If http.status > 0 Then ok = True
  End If
  On Error GoTo 0
  IsPreviewUp = ok
End Function

' Vrai si le verrou existe et a moins de ttlSec secondes.
Function LockIsFresh(path, ttlSec)
  Dim f, ageSec
  LockIsFresh = False
  If Not fso.FileExists(path) Then Exit Function
  On Error Resume Next
  Set f = fso.GetFile(path)
  ageSec = DateDiff("s", f.DateLastModified, Now)
  On Error GoTo 0
  If ageSec >= 0 And ageSec < ttlSec Then LockIsFresh = True
End Function

Sub WriteLock(path)
  Dim f
  On Error Resume Next
  Set f = fso.CreateTextFile(path, True)
  f.WriteLine CStr(Now)
  f.Close
  On Error GoTo 0
End Sub

' Ouvre l'URL dans Edge en mode app maximise ; repli navigateur par defaut.
Sub OpenWindow(targetUri)
  If fso.FileExists(edge) Then
    shell.Run """" & edge & """ --app=""" & targetUri & """ --start-maximized", 1, False
  Else
    shell.Run """" & targetUri & """", 1, False
  End If
End Sub

' Genere .loading-preview.gen.html a partir du gabarit, avec les 3
' derniers sujets de commit injectes (bloc vide si git indisponible).
Sub BuildLoadingPage
  Dim subjects, total, block, items, shown, arr, i, line, html

  On Error Resume Next
  shell.Run "cmd /c chcp 65001>nul & git -C """ & dir & """ log -3 --format=%s 1> """ & tmpLog & """ 2>nul", 0, True
  shell.Run "cmd /c git -C """ & dir & """ rev-list --count HEAD 1> """ & tmpCnt & """ 2>nul", 0, True
  On Error GoTo 0

  subjects = ""
  total = 0
  If fso.FileExists(tmpLog) Then subjects = ReadUtf8(tmpLog)
  If fso.FileExists(tmpCnt) Then total = CLng("0" & Trim(ReadAscii(tmpCnt)))

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

  html = ReadUtf8(template)
  html = Replace(html, "<!--CHANGELOG-->", block)
  WriteUtf8 genFile, html

  On Error Resume Next
  If fso.FileExists(tmpLog) Then fso.DeleteFile tmpLog
  If fso.FileExists(tmpCnt) Then fso.DeleteFile tmpCnt
  On Error GoTo 0
End Sub

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
