export default function Home() {
  return (
    <main>
      <h1>LCP Hints Test</h1>
      <p>
        Check the response headers - you should see a Link header for /hero.jpg
      </p>
      <img src="/hero.jpg" alt="Hero" width={800} height={400} />
    </main>
  )
}
