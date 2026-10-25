import { useEffect } from 'react'

/** Sets the browser tab title, e.g. "Reports · DueProof". */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · DueProof` : 'DueProof'
  }, [title])
}
