/** @type {import('next').NextConfig} */
const nextConfig = {
  lcpHints: {
    '/': {
      image: '/hero.jpg',
    },
    '/about': {
      font: '/fonts/inter.woff2',
    },
    '/dynamic': {
      image: '/dynamic-hero.jpg',
    },
  },
}

module.exports = nextConfig
