# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Places a window at an exact size and/or saves a lossless PNG of just that
# window. Used for listing screenshots of the test profile (1280x800).
#   capture_window.ps1 -ProcessId 1234 -Place
#   capture_window.ps1 -ProcessId 1234 -Out shot.png

param(
  [Parameter(Mandatory)] [int] $ProcessId,
  [string] $Out,
  [int] $X = 60, [int] $Y = 60, [int] $Width = 1280, [int] $Height = 800,
  [switch] $Place
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class KristalWin {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hgt, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
}
"@
[void][KristalWin]::SetProcessDPIAware()

$h = (Get-Process -Id $ProcessId).MainWindowHandle
if ($h -eq [IntPtr]::Zero) { throw "No main window for PID $ProcessId" }

function Get-Frame($handle) {
  $r = New-Object KristalWin+RECT
  [void][KristalWin]::DwmGetWindowAttribute($handle, 9, [ref]$r, 16)
  return $r
}

if ($Place) {
  [void][KristalWin]::ShowWindow($h, 9)
  [void][KristalWin]::SetWindowPos($h, [IntPtr]::Zero, $X, $Y, $Width, $Height, 0x0040)
  Start-Sleep -Milliseconds 400
  # The outer window includes invisible resize borders; correct for them so
  # the visible frame is exactly Width x Height at X, Y.
  $outer = New-Object KristalWin+RECT
  [void][KristalWin]::GetWindowRect($h, [ref]$outer)
  $frame = Get-Frame $h
  $dl = $frame.Left - $outer.Left; $dt = $frame.Top - $outer.Top
  $dr = $outer.Right - $frame.Right; $db = $outer.Bottom - $frame.Bottom
  [void][KristalWin]::SetWindowPos($h, [IntPtr]::Zero, $X - $dl, $Y - $dt, $Width + $dl + $dr, $Height + $dt + $db, 0x0040)
  Start-Sleep -Milliseconds 400
}

[void][KristalWin]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 300
$f = Get-Frame $h
$w = $f.Right - $f.Left; $hh = $f.Bottom - $f.Top
"frame: $($f.Left),$($f.Top) ${w}x${hh}"

if ($Out) {
  $bmp = New-Object System.Drawing.Bitmap $w, $hh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($f.Left, $f.Top, 0, 0, (New-Object System.Drawing.Size $w, $hh))
  $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  "saved $Out"
}
