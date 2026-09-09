
$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue
try {
    $deck = $ppt.Presentations.Open('C:\Users\datha\Downloads\Crypto\sih ppt\SIH2026-IDEA-Presentation-Format.pptx')
    $deck.SaveAs('C:\Users\datha\Downloads\Crypto\sih ppt\SIH2026-IDEA-Presentation-Format.pdf', 32)
    Write-Host "PDF Exported Successfully: C:\Users\datha\Downloads\Crypto\sih ppt\SIH2026-IDEA-Presentation-Format.pdf"
    
    $previewDir = 'C:\Users\datha\Downloads\Crypto\sih ppt\previews'
    if (!(Test-Path $previewDir)) { New-Item -ItemType Directory -Path $previewDir -Force | Out-Null }
    
    for ($i = 1; $i -le $deck.Slides.Count; $i++) {
        $outPng = Join-Path $previewDir "slide_$i.png"
        if (Test-Path $outPng) { Remove-Item $outPng -Force }
        $deck.Slides.Item($i).Export($outPng, 'PNG', 1920, 1080)
        Write-Host "Exported slide $i to $outPng"
    }
    $deck.Close()
} finally {
    $ppt.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
