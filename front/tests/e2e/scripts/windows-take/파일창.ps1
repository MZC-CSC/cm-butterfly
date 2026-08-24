<#
  파일 고르는 창 안에서 "누를 자리"를 찾아 좌표로 돌려준다.

  ★ 왜 필요한가 — 창은 운영체제가 그리므로 브라우저 쪽에서는 그 안이 보이지 않는다. 경로를
    붙여 넣고 엔터를 치면 열리기는 하지만, 사람이 파일을 고르는 장면은 그것이 아니다.
    폴더에서 파일을 눈으로 찾아 누르는 것이 사람이 하는 일이고, 그 장면을 찍으려면 파일이
    화면 어디에 그려졌는지를 알아야 한다. 그것을 알려주는 것이 UI Automation 이다.

  누르는 것은 이 스크립트가 하지 않는다. 좌표만 돌려주고, 커서를 옮겨 누르는 것은
  조작.mjs 의 커서가 한다 — 움직임이 이어져야 영상에서 한 손으로 읽힌다.

  ★ 이 파일은 BOM 이 있는 UTF-8 로 저장한다. 윈도우 PowerShell 5.1 은 BOM 이 없는 .ps1 을
    ANSI 로 읽어 한글이 깨지고, 깨진 따옴표 때문에 파일 전체가 구문 오류가 된다.

  사용:  powershell -NoProfile -File 파일창.ps1 -FileName 연결정보.xlsx
  결과:  {"item":{"x":..,"y":..},"open":{"x":..,"y":..}}   (화면 좌표, 각 요소의 한가운데)
#>
param(
  [Parameter(Mandatory = $true)][string]$FileName,
  [int]$TimeoutSec = 20
)

$ErrorActionPreference = 'Stop'
# 알림 문구가 node 쪽에서 깨지지 않게 — 기본은 콘솔 코드페이지(한국어 윈도우에서 CP949)다.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DpiProbe { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }
"@
# 좌표를 화면 그대로 받기 위해 — 배율을 모르는 프로세스는 운영체제가 값을 바꿔 준다.
[void][DpiProbe]::SetProcessDPIAware()

$AE = [System.Windows.Automation.AutomationElement]
$Scope = [System.Windows.Automation.TreeScope]
$CT = [System.Windows.Automation.ControlType]
$TrueCond = [System.Windows.Automation.Condition]::TrueCondition

function Center($el) {
  $r = $el.Current.BoundingRectangle
  if ($r.Width -le 0 -or $r.Height -le 0) { return $null }
  return @{ x = [int]($r.X + $r.Width / 2); y = [int]($r.Y + $r.Height / 2) }
}

<#
  창 후보를 모은다.

  ★ 파일 창은 바탕화면 바로 밑에 있을 때도 있고, 브라우저 창에 딸린 자식으로 들어갈 때도 있다.
    바탕화면의 자식만 보면 후자를 놓친다 — 실제로 그래서 "창을 찾지 못했다" 로 멈췄다.
    그렇다고 바탕화면부터 전부 뒤지면 열려 있는 창 수만큼 느려지므로, 두 단(段)만 본다.
#>
function Get-DialogCandidates {
  $found = @()
  foreach ($top in $AE::RootElement.FindAll($Scope::Children, $TrueCond)) {
    if ($top.Current.ClassName -eq '#32770') { $found += $top; continue }
    try {
      foreach ($kid in $top.FindAll($Scope::Children, $TrueCond)) {
        if ($kid.Current.ClassName -eq '#32770') { $found += $kid }
      }
    } catch { }
  }
  return $found
}

function Describe-Windows {
  $lines = @()
  foreach ($top in $AE::RootElement.FindAll($Scope::Children, $TrueCond)) {
    $lines += "$($top.Current.ClassName) / $($top.Current.Name)"
  }
  return ($lines -join ' | ')
}

function Fail($msg) {
  Write-Output (@{ error = "$msg (보이는 창: $(Describe-Windows))" } | ConvertTo-Json -Compress)
  exit 1
}

$base = [System.IO.Path]::GetFileNameWithoutExtension($FileName)
$itemCond = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, $CT::ListItem)

function Find-Item($dlg) {
  foreach ($el in $dlg.FindAll($Scope::Descendants, $itemCond)) {
    $n = $el.Current.Name
    if ($n -and ($n -eq $FileName -or $n -like "$base*") -and (Center $el)) { return $el }
  }
  return $null
}

<#
  "열기" 단추.

  ★ 종류를 정해 놓고 찾지 않는다. 현대 파일 창에서 이 단추는 화살표가 붙어 SplitButton 으로
    올라오기도 하고, 언어 설정에 따라 이름도 달라진다. 종류로 걸렀더니 창도 항목도 다 찾아
    놓고 단추에서만 멈췄다. 공용 대화상자의 확인 단추는 예부터 AutomationId 가 "1"(IDOK)
    이므로 그것을 먼저 보고, 없으면 이름으로 찾는다.
#>
function Find-Open($dlg) {
  $all = $dlg.FindAll($Scope::Descendants, $TrueCond)
  foreach ($el in $all) {
    if ($el.Current.AutomationId -eq '1' -and (Center $el)) { return $el }
  }
  foreach ($el in $all) {
    if ($el.Current.Name -match '^(열기|Open)' -and (Center $el)) { return $el }
  }
  return $null
}

function Describe-Buttons($dlg) {
  $names = @()
  foreach ($el in $dlg.FindAll($Scope::Descendants, $TrueCond)) {
    $n = $el.Current.Name
    if ($n) { $names += "$($el.Current.ControlType.ProgrammaticName.Split('.')[-1]):$n[$($el.Current.AutomationId)]" }
  }
  return (($names | Select-Object -First 40) -join ' | ')
}

<#
  창을 기다린다.

  ★ 후보를 하나만 보고 결정하지 않는다. 화면에는 #32770 인 창이 여럿 떠 있을 수 있고(다른 앱의
    작은 대화상자도 같은 클래스다), 그 중 하나만 집으면 엉뚱한 창 안에서 파일을 찾다 끝난다.
    "파일도 있고 열기 단추도 있는 창" 이라야 우리가 찾는 창이다.
#>
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$dlg = $null; $item = $null; $open = $null; $seen = ''
while ((Get-Date) -lt $deadline) {
  foreach ($cand in Get-DialogCandidates) {
    $i = Find-Item $cand
    if (-not $i) { continue }
    $o = Find-Open $cand
    if (-not $o) { $seen = Describe-Buttons $cand; continue }
    $dlg = $cand; $item = $i; $open = $o
    break
  }
  if ($dlg) { break }
  Start-Sleep -Milliseconds 200
}
if (-not $dlg) {
  if ($seen) { Fail "파일은 찾았는데 열기 단추를 못 찾았다 - 창 안에 있는 것: $seen" }
  Fail "파일 창에서 $FileName 을 찾지 못했다"
}

$ic = Center $item
$oc = Center $open
if (-not $ic -or -not $oc) { Fail '누를 자리의 크기가 0 이다 - 창이 아직 그려지지 않았다' }

Write-Output (@{ item = $ic; open = $oc } | ConvertTo-Json -Compress)
