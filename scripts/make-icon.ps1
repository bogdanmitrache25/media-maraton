Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$outPath) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 11, 15, 20))
  $g.FillRectangle($bg, 0, 0, $size, $size)

  $pad = [int]($size * 0.13)
  $rect = New-Object System.Drawing.Rectangle($pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad))

  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 34, 211, 238),
    [System.Drawing.Color]::FromArgb(255, 34, 197, 94),
    45.0
  )
  $g.FillEllipse($grad, $rect)

  $fontSize = [float]($size * 0.30)
  $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 4, 33, 43))
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $g.DrawString('1:50', $font, $fg, (New-Object System.Drawing.RectangleF(0, 0, $size, $size)), $fmt)

  $dir = Split-Path -Parent $outPath
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose(); $bmp.Dispose(); $font.Dispose(); $grad.Dispose(); $bg.Dispose(); $fg.Dispose()
  Write-Host "Generado $outPath ($size x $size)"
}

New-Icon 180  'C:\Users\MSI\Desktop\MediaMaraton2027\public\apple-touch-icon.png'
New-Icon 192  'C:\Users\MSI\Desktop\MediaMaraton2027\public\icon-192.png'
New-Icon 512  'C:\Users\MSI\Desktop\MediaMaraton2027\public\icon-512.png'
