import { redirect } from 'next/navigation'

// The reviews dashboard now lives on the home route; keep this path as a
// redirect so existing links and the post-sign-in fallback stay valid.
export default function ReviewPage() {
  redirect('/')
}
