'use client'

import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

export function LanguageToggle() {
  const { locale, toggleLocale, t } = useI18n()
  const nextLabel = locale === 'es' ? t('switchToEnglish') : t('switchToSpanish')

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 px-2"
      onClick={toggleLocale}
      title={nextLabel}
      aria-label={nextLabel}
    >
      <Languages className="h-4 w-4" />
      <span className="text-xs font-semibold uppercase">{locale}</span>
    </Button>
  )
}
