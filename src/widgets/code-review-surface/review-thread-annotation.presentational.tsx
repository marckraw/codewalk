import { DraftReviewThreadAnnotation } from './draft-review-thread-annotation.presentational'
import { PersistedReviewThreadAnnotation } from './persisted-review-thread-annotation.presentational'
import type { ReviewThreadAnnotationData } from './review-thread-annotation.types'

export function ReviewThreadAnnotation({
  annotation,
}: {
  annotation: ReviewThreadAnnotationData
}) {
  if (annotation.kind === 'draft') {
    return <DraftReviewThreadAnnotation annotation={annotation} />
  }

  return <PersistedReviewThreadAnnotation annotation={annotation} />
}
