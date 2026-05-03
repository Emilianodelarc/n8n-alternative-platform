'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Plus, Trash2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createBackendCredential, deleteBackendCredential, fetchBackendCredentials, type CredentialSummary } from '@/lib/workflow/api-client'
import { useI18n } from '@/lib/i18n'

const serviceDefaults: Record<string, { name: string; credentialType: string; tokenLabel: string; tokenPlaceholder: string }> = {
  google: {
    name: 'Google OAuth',
    credentialType: 'bearerToken',
    tokenLabel: 'OAuth Access Token',
    tokenPlaceholder: 'ya29...',
  },
  slack: {
    name: 'Slack Bot',
    credentialType: 'bearerToken',
    tokenLabel: 'Bot User OAuth Token',
    tokenPlaceholder: 'xoxb-...',
  },
  generic: {
    name: 'API Credential',
    credentialType: 'bearerToken',
    tokenLabel: 'Bearer Token',
    tokenPlaceholder: 'secret token',
  },
}

export function CredentialsPanel() {
  const { t } = useI18n()
  const [credentials, setCredentials] = useState<CredentialSummary[]>([])
  const [service, setService] = useState('google')
  const [name, setName] = useState(serviceDefaults.google.name)
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const selectedService = serviceDefaults[service] || serviceDefaults.generic

  const loadCredentials = async () => {
    setIsLoading(true)
    setError(null)
    try {
      setCredentials(await fetchBackendCredentials())
    } catch (loadError) {
      setError((loadError as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCredentials()
  }, [])

  const handleServiceChange = (nextService: string) => {
    setService(nextService)
    setName(serviceDefaults[nextService]?.name || serviceDefaults.generic.name)
  }

  const handleCreate = async () => {
    if (!name.trim() || !token.trim()) return

    setIsSaving(true)
    setError(null)
    try {
      const credential = await createBackendCredential({
        name: name.trim(),
        service,
        config: {
          credentialType: selectedService.credentialType,
          accessToken: token.trim(),
        },
      })
      setCredentials((items) => [credential, ...items])
      setToken('')
    } catch (createError) {
      setError((createError as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    try {
      await deleteBackendCredential(id)
      setCredentials((items) => items.filter((credential) => credential.id !== id))
    } catch (deleteError) {
      setError((deleteError as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{t('credentials')}</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadCredentials} disabled={isLoading}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t('credentialsDescription')}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {error && (
            <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-border bg-card/60 p-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('service')}</Label>
              <Select value={service} onValueChange={handleServiceChange}>
                <SelectTrigger className="bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="generic">{t('generic')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('credentialName')}</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} className="bg-input" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{selectedService.tokenLabel}</Label>
              <Input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={selectedService.tokenPlaceholder}
                className="bg-input"
              />
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={isSaving || !name.trim() || !token.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {t('saveCredential')}
            </Button>
          </div>

          <div className="space-y-2">
            {credentials.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {isLoading ? t('loading') : t('noCredentials')}
              </div>
            ) : (
              credentials.map((credential) => (
                <div key={credential.id} className="rounded-lg border border-border bg-card/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{credential.name}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {credential.service}
                        </Badge>
                      </div>
                      <code className="mt-1 block truncate rounded bg-muted px-1.5 py-1 text-[10px] text-muted-foreground">
                        {credential.id}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive"
                      onClick={() => handleDelete(credential.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

