'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Upload, CheckCircle, AlertTriangle, FileText,
  X, Clock, Send
} from 'lucide-react'

interface DocRequest {
  id: string
  title: string
  description: string | null
  document_types: string[]
  status: string
  expires_at: string
  clients?: { name: string; email: string | null; phone: string | null } | null
  profiles?: { full_name: string } | null
}

export function PortalDocClient({
  request,
  isExpired,
}: {
  request: DocRequest
  isExpired: boolean
}) {
  const [uploads, setUploads] = useState<Record<string, File | null>>({})
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clientName = (request.clients as { name: string } | null)?.name
  const creatorName = (request.profiles as { full_name: string } | null)?.full_name

  function handleFile(docType: string, file: File | null) {
    setUploads(prev => ({ ...prev, [docType]: file }))
  }

  async function handleSubmit() {
    const hasFiles = Object.values(uploads).some(f => f !== null)
    if (!hasFiles) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('request_id', request.id)
      Object.entries(uploads).forEach(([docType, file]) => {
        if (file) {
          formData.append('document_type', docType)
          formData.append('file', file)
        }
      })
      const res = await fetch('/api/portal/doc/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Error en la pujada')
      setDone(true)
    } catch {
      setError('Hi ha hagut un error en pujar els documents. Torna-ho a intentar.')
    } finally {
      setUploading(false)
    }
  }

  const uploadedCount = Object.values(uploads).filter(Boolean).length

  if (isExpired) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
            <Clock className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold">Link caducat</h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Aquest link per pujar documents ha caducat. Contacta amb Tràmit Economistes per obtenir un nou accés.
          </p>
          <a href="mailto:info@tramiteconomistes.com"
            className="inline-flex items-center gap-2 bg-tramit-blue text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-tramit-blue-dark transition-colors">
            Contactar
          </a>
        </CardContent>
      </Card>
    )
  }

  if (done) {
    return (
      <Card className="border-green-200 dark:border-green-800">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="text-xl font-bold">Documents enviats!</h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Hem rebut els teus documents correctament. Tràmit Economistes els revisarà i et contactarà si necessita alguna cosa més.
          </p>
          <p className="text-xs text-muted-foreground">Pots tancar aquesta pàgina.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Capçalera */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{request.title}</h1>
        {clientName && (
          <p className="text-muted-foreground text-sm">Per a: <strong>{clientName}</strong></p>
        )}
        {creatorName && (
          <p className="text-xs text-muted-foreground">Sol·licitat per {creatorName} · Tràmit Economistes</p>
        )}
      </div>

      {/* Descripció */}
      {request.description && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{request.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Documents a pujar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Documents necessaris ({request.document_types.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {request.document_types.map(docType => {
            const file = uploads[docType]
            return (
              <div key={docType} className={`p-4 rounded-xl border-2 transition-colors ${
                file ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10' : 'border-dashed border-border'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${file ? 'bg-green-100 dark:bg-green-900/20' : 'bg-muted'}`}>
                    {file ? <CheckCircle className="h-4 w-4 text-green-600" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{docType}</p>
                    {file && <p className="text-xs text-muted-foreground mt-0.5 truncate">{file.name}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {file && (
                      <button onClick={() => handleFile(docType, null)}
                        className="p-1.5 text-muted-foreground hover:text-red-600 rounded-md transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <label className="cursor-pointer">
                      <input type="file" className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx,.xls,.xlsx"
                        onChange={e => handleFile(docType, e.target.files?.[0] || null)} />
                      <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        file
                          ? 'border-green-300 text-green-700 hover:bg-green-50'
                          : 'border-border text-muted-foreground hover:border-tramit-blue hover:text-tramit-blue'
                      }`}>
                        <Upload className="h-3.5 w-3.5" />
                        {file ? 'Canviar' : 'Pujar'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Botó enviar */}
      <div className="space-y-2">
        <Button
          variant="tramit"
          className="w-full flex items-center gap-2 py-3"
          onClick={handleSubmit}
          disabled={uploading || uploadedCount === 0}
        >
          {uploading ? (
            <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Pujant documents...</>
          ) : (
            <><Send className="h-4 w-4" />Enviar {uploadedCount > 0 ? `${uploadedCount} document${uploadedCount > 1 ? 's' : ''}` : 'documents'}</>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Formats acceptats: PDF, JPG, PNG, Word, Excel · Màxim 50 MB per arxiu
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-4">
        Tràmit Economistes · Accés segur i confidencial
        <br />
        Aquest link caduca el {new Date(request.expires_at).toLocaleDateString('ca-ES')}
      </p>
    </div>
  )
}
