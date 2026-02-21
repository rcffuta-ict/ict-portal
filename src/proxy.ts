import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value
  const { pathname } = request.nextUrl

  // Define route types
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/api') ||
                       pathname.includes('.') // Files with extensions (images, etc.)
  const isDashboardPage = pathname.startsWith('/dashboard')

  // Skip middleware for public assets
  if (isPublicAsset) {
    return NextResponse.next()
  }

  // Public routes that don't need authentication
  const publicRoutes = ['/', '/forgot-password', '/about', '/lo-app', '/events']
  const isPublicRoute = publicRoutes.includes(pathname) ||
                       (pathname.startsWith('/events/') && !pathname.endsWith('/admin'))

  // Handle authentication requirements
  if (!token) {
    // Unauthenticated user trying to access dashboard
    if (isDashboardPage) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('returnUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Allow access to public routes and auth pages
    if (isPublicRoute || isAuthPage) {
      return NextResponse.next()
    }

    // For any other route, redirect to login (defensive approach)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user - redirect away from auth pages to dashboard
  if (token && isAuthPage) {
    const returnUrl = request.nextUrl.searchParams.get('returnUrl')
    const redirectUrl = returnUrl && returnUrl.startsWith('/') ? returnUrl : '/dashboard'
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
