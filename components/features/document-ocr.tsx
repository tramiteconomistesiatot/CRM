'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Upload, FileText, CheckCircle, AlertTriangle,
  Loader2, X, Eye, Download, Sparkles
} from 'lucide-react'

interface OCRData {
  document_type: string | null
  date: string | null
  amount: string | null
  tax_amount: string | null
  total_amount: string | null
  issuer_name: string | null
  issuer_nif: string | null
  recipient_name: string | null
  recipient_nif: string | null
  concept: string | null
  invoice_number: string | null
  period: string | null
  model: string | null
  raw_text: string | null
  key_data: string[]
  anomalies: string[]
  confidence: 'high' | 'medium' | 'low'
}

interface OCRResult {
  success: boolean
  document_id: string
  ocr_data: OCRData
  summary: string
}

const DOC_TYPE_LABELS: Record<string, string> = {
  nomina: '💰 Nòmina',
  factura: '🧾 Factura',
  declaracio: '📋 Declaració fiscal',
  rebut: '🗒️ Rebut',
  contracte: '📄 Contracte',
  extracte: '🏦 Extracte bancari',
  other: '📁 Document',
}

const CONFIDENCE_CONFIG = {
  high: { label: 'Alta precisió', style: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  medium: { label: 'Precisió mitjana', style: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  low: { label: 'Precisió baixa', style: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
}

export function DocumentOCR({ clientId }: { clientId?: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<OCRResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRawText, setShowRawText] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(selectedFile: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(selectedFile.type)) {
      setError('Format no suportat. Usa JPG, PNG, WEBP o PDF.')
      return
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('El fitxer és massa gran. Màxim 10MB.')
      return
    }

    setFile(selectedFile)
    setError(null)
    setResult(null)

    if (selectedFile.type !== 'application/pdf') {
      const reader = new FileReader()
      reader.onload = e => setPreview(e.target?.result as string)
      reader.readAsDataURL(selectedFile)
    } else {
      setPreview(null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFileSelect(dropped)
  }

  async function analyzeDocument() {
    if (!file) return
    setProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (clientId) formData.append('client_id', clientId)

      const res = await fetch('/api/documents/ocr', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error analitzant el document')
    } finally {
      setProcessing(false)
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function exportData() {
    if (!result) return
    const json = JSON.stringify(result.ocr_data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ocr-${file?.name || 'document'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const ocr = result?.ocr_data
  const confidence = ocr?.confidence || 'medium'

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-tramit-blue" />
        <h2 className="text-lg font-semibold">Anàlisi de documents amb IA</h2>
      </div>

      {/* Zona d'upload */}
      {!file && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-tramit-blue bg-tramit-blue-light dark:bg-blue-900/20'
              : 'border-border hover:border-tramit-blue/50 hover:bg-muted/30'
          }`}
        >
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium text-sm">Arrossega un document aquí</p>
          <p className="text-xs text-muted-foreground mt-1">
            o clica per seleccionar · JPG, PNG, WEBP, PDF · Màxim 10MB
          </p>
          <p className="text-xs text-tramit-blue mt-3 font-medium">
            Nòmines · Factures · Declaracions · Rebuts · Extractes
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />
        </div>
      )}

      {/* Previsualització del fitxer */}
      {file && !result && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-4">
              {preview ? (
                <img src={preview} alt="Preview" className="h-24 w-20 object-cover rounded-lg border border-border shrink-0" />
              ) : (
                <div className="h-24 w-20 bg-muted rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {file.type === 'application/pdf' ? 'PDF' : 'Imatge'} ·
                  {(file.size / 1024).toFixed(0)}KB
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="tramit"
                    onClick={analyzeDocument}
                    disabled={processing}
                    className="flex items-center gap-2"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analitzant...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Analitzar amb IA
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="icon" onClick={reset}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {processing && (
              <div className="mt-4 space-y-2">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-tramit-blue rounded-full animate-pulse w-2/3" />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  L&apos;IA està llegint i analitzant el document...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resultat OCR */}
      {result && ocr && (
        <div className="space-y-4">
          {/* Resum */}
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">Document analitzat correctament</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_CONFIG[confidence].style}`}>
                      {CONFIDENCE_CONFIG[confidence].label}
                    </span>
                    {ocr.document_type && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-tramit-blue-light dark:bg-blue-900/20 text-tramit-blue">
                        {DOC_TYPE_LABELS[ocr.document_type] || ocr.document_type}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{result.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dades extretes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Dades extretes</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={exportData} className="flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    JSON
                  </Button>
                  <Button size="sm" variant="outline" onClick={reset} className="flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    Nou
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Data', value: ocr.date },
                  { label: 'Import', value: ocr.amount ? `${ocr.amount}€` : null },
                  { label: 'IVA', value: ocr.tax_amount ? `${ocr.tax_amount}€` : null },
                  { label: 'Total', value: ocr.total_amount ? `${ocr.total_amount}€` : null },
                  { label: 'Emissor', value: ocr.issuer_name },
                  { label: 'NIF emissor', value: ocr.issuer_nif },
                  { label: 'Receptor', value: ocr.recipient_name },
                  { label: 'NIF receptor', value: ocr.recipient_nif },
                  { label: 'Concepte', value: ocr.concept },
                  { label: 'Núm. factura', value: ocr.invoice_number },
                  { label: 'Període', value: ocr.period },
                  { label: 'Model fiscal', value: ocr.model },
                ].filter(item => item.value).map(item => (
                  <div key={item.label} className="space-y-0.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium">{item.value}</p>
                  </div>
                ))}
              </div>

              {ocr.key_data && ocr.key_data.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Dades clau
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ocr.key_data.map((item, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-tramit-blue-light dark:bg-blue-900/20 text-tramit-blue">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {ocr.anomalies && ocr.anomalies.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <p className="text-xs font-medium text-amber-600">Anomalies detectades</p>
                  </div>
                  <ul className="space-y-1">
                    {ocr.anomalies.map((item, i) => (
                      <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                        <span className="shrink-0">·</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {ocr.raw_text && (
                <div className="mt-4 pt-4 border-t">
                  <button
                    onClick={() => setShowRawText(!showRawText)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {showRawText ? 'Amagar' : 'Veure'} text complet extret
                  </button>
                  {showRawText && (
                    <div className="mt-2 p-3 bg-muted/50 rounded-lg max-h-48 overflow-y-auto">
                      <p className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                        {ocr.raw_text}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
