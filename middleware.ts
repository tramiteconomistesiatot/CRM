import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  console.log(`[Middleware] Path: ${pathname} | User authenticated: ${!!user}`);

  // Rutes públiques (no requereixen autenticació)
  const publicRoutes = ['/login', '/api/auth']
  const isPublic = publicRoutes.some(route => pathname.startsWith(route))

  // API routes — gestió pròpia
  if (pathname.startsWith('/api/')) return response

  // Redirigir a login si no autenticat
  if (!user && !isPublic) {
    console.log(`[Middleware] Redirecting unauthenticated user from ${pathname} to /login`);
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = user?.user_metadata?.role || 'worker'

  // Restringir rutes de dashboard als treballadors
  if (user && role === 'worker' && pathname.startsWith('/dashboard')) {
    console.log(`[Middleware] Redirecting worker from ${pathname} to /worker`);
    return NextResponse.redirect(new URL('/worker', request.url))
  }

  // Redirigir de login si ja autenticat
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Redirigir l'arrel
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
