' Lance TraCflux en mode PREVIEW (build de production servi localement),
' dans une fenetre Chrome maximisee.
'
' Variante Chrome du lanceur principal (Lancer-preview.vbs). Meme logique
' idempotente a 3 branches, meme verrou, meme page d'attente. Seule la
' partie OpenWindow change : on lance chrome.exe avec un profil dedie
' (.chrome-preview-profile) pour les memes raisons que cote Edge :
' --start-maximized est ignore si Chrome est deja en tache de fond
' avec le profil par defaut.

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

template   = dir & "\loading-preview.html"
genFile    = dir & "\.loading-preview.gen.html"
tmpLog     = dir & "\.gitlog.tmp"
tmpCnt     = dir & "\.gitcount.tmp"
lockFile   = dir & "\.preview.lock"
baseFile   = dir & "\.preview.built"   ' commit du dernier build previewe
logFile    = dir & "\.preview-build.log"   ' sortie build+preview (debug)
runFile    = dir & "\.preview-build.cmd"   ' batch genere a chaque lancement
previewUrl = "http://localhost:4173"
LOCK_TTL   = 90    ' secondes : au-dela, un verrou est considere perime

' Emplacement de chrome.exe (trois chemins possibles selon l'install)
chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chrome) Then
  chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
End If
If Not fso.FileExists(chrome) Then
  chrome = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & _
           "\Google\Chrome\Application\chrome.exe"
End If

' ---- Branche 1 : un serveur preview repond deja -> fenetre directe ----
If IsPreviewUp(previewUrl) Then
  OpenWindow previewUrl
  WScript.Quit
End If

curHead = Trim(Replace(Replace(GitCapture("rev-parse HEAD"), vbCr, ""), vbLf, ""))

' ---- Branche 2 : un build est deja en cours (verrou frais) ----
If LockIsFresh(lockFile, LOCK_TTL) Then
  BuildLoadingPage
  OpenWindow "file:///" & Replace(Replace(genFile, "\", "/"), " ", "%20")
  WScript.Quit
End If

' ---- Branche 3 : premier lancement -> verrou + attente + build ----
WriteLock lockFile
BuildLoadingPage
OpenWindow "file:///" & Replace(Replace(genFile, "\", "/"), " ", "%20")

Dim bf
Set bf = fso.CreateTextFile(runFile, True, False)
bf.WriteLine "@echo on"
bf.WriteLine "echo === Preview launcher (Chrome) %DATE% %TIME% ==="
bf.WriteLine "cd /d """ & dir & """"
bf.WriteLine "echo Working directory: %CD%"
bf.WriteLine "call npm run build"
bf.WriteLine "if errorlevel 1 ( echo *** BUILD FAILED *** & exit /b 1 )"
bf.WriteLine "echo Build OK, removing lock and writing baseline (" & curHead & ")"
bf.WriteLine "del /f /q """ & lockFile & """ 2>nul"
bf.WriteLine "echo " & curHead & "> """ & baseFile & """"
bf.WriteLine "echo Starting preview server..."
bf.WriteLine "call npm run preview"
bf.Close

Dim q : q = Chr(34)
shell.Run "cmd /c " & q & q & runFile & q & " > " & q & logFile & q & " 2>&1" & q, 0, False

' ===================== Procedures / fonctions =====================

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

' Ouvre l'URL dans Chrome, fenetre maximisee.
'
' POURQUOI --user-data-dir : sans profil dedie, Chrome reutilise un
' processus existant (cas frequent : Chrome ouvert avec ton profil
' habituel) qui IGNORE les flags de fenetre. Avec un profil isole, un
' NOUVEAU processus demarre et --start-maximized est respecte.
'
' Le fichier "First Run" pre-cree saute l'ecran d'accueil "synchroniser
' avec un compte Google" qui apparait sinon a chaque profil neuf.
'
' PAS de --app= : ce flag mettrait Chrome en "mode application" (sans
' onglets ni barre d'adresse) mais casse window.open() - les fenetres
' detachees de TraCflux s'ouvrent plein ecran ou sont silencieusement
' bloquees. Pour l'experience "app installee", passer par le bouton
' "Installer cette app" dans la barre d'adresse Chrome.
Sub OpenWindow(targetUri)
  Dim profile, sentinel, f
  If fso.FileExists(chrome) Then
    profile = dir & "\.chrome-preview-profile"
    If Not fso.FolderExists(profile) Then fso.CreateFolder profile
    sentinel = profile & "\First Run"
    If Not fso.FileExists(sentinel) Then
      Set f = fso.CreateTextFile(sentinel, True)
      f.Close
    End If
    shell.Run """" & chrome & """ """ & targetUri & """" & _
              " --user-data-dir=""" & profile & """" & _
              " --no-first-run --no-default-browser-check" & _
              " --start-maximized", 1, False
  Else
    shell.Run """" & targetUri & """", 1, False
  End If
End Sub

Sub BuildLoadingPage
  Dim lastBuilt, hasBaseline, subjects, total, block, items, shown, arr, i, line, html

  lastBuilt = ""
  If fso.FileExists(baseFile) Then lastBuilt = Trim(ReadAscii(baseFile))
  hasBaseline = (Len(lastBuilt) > 0)

  subjects = "" : total = 0
  If Not hasBaseline Then
    subjects = GitCapture("log -3 --format=%s")
    total = CLng("0" & Trim(GitCapture("rev-list --count HEAD")))
  ElseIf lastBuilt = curHead Then
    subjects = ""
  Else
    subjects = GitCapture("log " & lastBuilt & "..HEAD --format=%s")
    total = CLng("0" & Trim(GitCapture("rev-list --count " & lastBuilt & "..HEAD")))
    If Len(Trim(subjects)) = 0 Then
      subjects = GitCapture("log -3 --format=%s")
      total = CLng("0" & Trim(GitCapture("rev-list --count HEAD")))
    End If
  End If

  block = "" : items = "" : shown = 0
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
              "<div class=""changelog-title"">Nouveaut&#233;s de cette mise &#224; jour</div>" & _
              "<ul>" & items & "</ul></div>"
    End If
  End If

  html = ReadUtf8(template)
  html = Replace(html, "<!--CHANGELOG-->", block)
  WriteUtf8 genFile, html
End Sub

Function GitCapture(argLine)
  Dim out
  out = ""
  On Error Resume Next
  shell.Run "cmd /c chcp 65001>nul & git -C """ & dir & """ " & argLine & " 1> """ & tmpLog & """ 2>nul", 0, True
  If fso.FileExists(tmpLog) Then
    out = ReadUtf8(tmpLog)
    fso.DeleteFile tmpLog
  End If
  On Error GoTo 0
  GitCapture = out
End Function

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
