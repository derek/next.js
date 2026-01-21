// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function DynamicPage() {
  return (
    <main>
      <h1>Dynamic Page</h1>
      <p>This page is dynamically rendered - check for Link header</p>
      <p>Current time: {new Date().toISOString()}</p>
    </main>
  )
}
