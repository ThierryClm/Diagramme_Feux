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
' La page d'attente n'affiche QUE les commits reellement nouveaux depuis
' le dernier build previewe (delta memorise dans .preview.built) ; rien
' si le code est inchange. Fichier ASCII volontairement (les .vbs sont lus
' en ANSI) : les accents passent par des entites HTML ou les sorties git UTF-8.

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
previewUrl = "http://localhost:4173"
LOCK_TTL   = 90    ' secondes : au-dela, un verrou est considere perime
                   ' (un build normal fait ~30-60 s)

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

' Au-dela de la branche 1, on aura besoin du HEAD courant (delta de
' changelog + memorisation post-build). On ne le calcule donc PAS sur le
' chemin rapide « serveur deja up » pour ne pas le ralentir.
curHead = Trim(GitCapture("rev-parse HEAD"))

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
' Apres un build reussi : on memorise le commit construit (curHead) dans
' baseFile -> le prochain lancement saura quoi montrer (delta) ou rien.
' Toute la sortie (build + preview) est redirigee vers .preview-build.log
' -> en cas de boucle infinie sur la page d'attente, ouvrir ce fichier
' pour voir ce qui a echoue (fenetre cmd cachee sinon muette).
shell.Run "cmd /c ( cd /d """ & dir & """ && npm run build && ( del /f /q """ & lockFile & """ 2>nul & echo " & curHead & ">""" & baseFile & """ & npm run preview ) ) > """ & logFile & """ 2>&1", 0, False

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

' Ouvre l'URL dans Edge en mode app, fenetre maximisee.
'
' POURQUOI --user-data-dir : sans profil dedie, Edge reutilise un
' processus existant (cas frequent : Edge en tache de fond) qui IGNORE
' les flags de fenetre. Avec un profil isole, un NOUVEAU processus
' demarre et --start-maximized est respecte.
'
' Pas de calcul de --window-size : la resolution WMI est physique, donc
' fausse quand la mise a l'echelle Windows est >100 % (la fenetre sort
' de l'ecran). Le maximize natif du systeme s'en charge correctement.
Sub OpenWindow(targetUri)
  Dim profile, sentinel, f
  If fso.FileExists(edge) Then
    profile = dir & "\.edge-preview-profile"
    ' Pre-creer le dossier de profil + le fichier sentinelle "First Run".
    ' Cette astuce Chromium standard fait croire a Edge que le premier
    ' demarrage a deja eu lieu, et SAUTE l'assistant "creer un compte
    ' Microsoft / synchroniser" qui apparait sinon a chaque profil neuf
    ' (le flag --no-first-run seul n'est plus suffisant).
    If Not fso.FolderExists(profile) Then fso.CreateFolder profile
    sentinel = profile & "\First Run"
    If Not fso.FileExists(sentinel) Then
      Set f = fso.CreateTextFile(sentinel, True)
      f.Close
    End If
    shell.Run """" & edge & """ --app=""" & targetUri & """" & _
              " --user-data-dir=""" & profile & """" & _
              " --no-first-run --no-default-browser-check" & _
              " --start-maximized", 1, False
  Else
    shell.Run """" & targetUri & """", 1, False
  End If
End Sub

' Genere .loading-preview.gen.html a partir du gabarit.
' Bloc « Nouveautes » = commits REELLEMENT nouveaux depuis le dernier
' build previewe (baseFile) :
'   - pas de reference (1er usage)        -> les 3 derniers (one-off)
'   - HEAD == dernier build previewe      -> aucun bloc
'   - sinon                               -> delta baseFile..HEAD (max 3 + ...)
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
    subjects = ""                       ' rien de neuf -> aucun bloc
  Else
    subjects = GitCapture("log " & lastBuilt & "..HEAD --format=%s")
    total = CLng("0" & Trim(GitCapture("rev-list --count " & lastBuilt & "..HEAD")))
    If Len(Trim(subjects)) = 0 Then     ' baseFile invalide -> repli 3 derniers
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

' Execute "git -C <dir> <args>" et renvoie sa sortie standard (UTF-8),
' chaine vide si git indisponible.
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
